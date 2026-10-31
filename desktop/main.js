"use strict";

/**
 * TV Center — self-contained desktop app.
 *
 * Everything runs inside Electron: the SQLite database, the REST/streaming
 * API, the scanner, and the built React UI. No Node, Python, or npm needed
 * on the user's machine.
 *
 * On launch: load the saved media folder (or ask for one), start the local
 * server, scan the folder, then show the library. The File menu can change
 * the folder or rescan.
 */

const { app, BrowserWindow, dialog, Menu, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const { openDb } = require("./lib/db");
const { createServer } = require("./lib/api");
const { scan } = require("./lib/scanner");

const USER_DIR = app.getPath("userData");
const DB_PATH = path.join(USER_DIR, "library.sqlite");
const CONFIG_PATH = path.join(USER_DIR, "config.json");
const RENDERER_DIR = path.join(__dirname, "renderer");

let win = null;
let db = null;
let baseUrl = "";
let scanning = false;

// --- config ---------------------------------------------------------------

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  fs.mkdirSync(USER_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

// --- loading screen ------------------------------------------------------

function showLoading() {
  if (win && !win.isDestroyed()) win.loadFile(path.join(__dirname, "loading.html"));
}

function status(line) {
  if (win && !win.isDestroyed()) win.webContents.send("status", line);
  process.stdout.write(line + "\n");
}

// --- folder picker + scan ----------------------------------------------

async function pickFolder({ allowCancel }) {
  const result = await dialog.showOpenDialog(win, {
    title: "Choose your TV shows folder",
    properties: ["openDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) {
    if (allowCancel) return null;
    const { response } = await dialog.showMessageBox(win, {
      type: "question",
      buttons: ["Choose Folder", "Quit"],
      defaultId: 0,
      message: "TV Center needs a folder of TV shows to work.",
    });
    if (response === 1) {
      app.quit();
      return null;
    }
    return pickFolder({ allowCancel });
  }
  return result.filePaths[0];
}

async function doScan(mediaRoot, { silent = false } = {}) {
  if (scanning) return;
  scanning = true;
  const log = silent ? (l) => process.stdout.write(l + "\n") : status;
  if (!silent) {
    showLoading();
    log("This can take a while the first time (fetching posters)…\n");
  }
  try {
    await scan(db, mediaRoot, log);
  } catch (err) {
    log(`Scan error: ${err && err.message ? err.message : err}`);
  }
  scanning = false;
  if (win && !win.isDestroyed()) {
    if (!silent) win.loadURL(baseUrl);
    else {
      // Background refresh: only reload the home page so playback isn't cut off.
      let onHome = false;
      try {
        onHome = new URL(win.webContents.getURL()).pathname === "/";
      } catch {
        /* ignore */
      }
      if (onHome) win.webContents.reloadIgnoringCache();
    }
  }
}

async function changeFolderAndScan() {
  if (scanning) return;
  const folder = await pickFolder({ allowCancel: true });
  if (!folder) return;
  writeConfig({ ...readConfig(), mediaRoot: folder });
  await doScan(folder);
}

async function rescan() {
  if (scanning) return;
  const cfg = readConfig();
  if (!cfg.mediaRoot) return changeFolderAndScan();
  await doScan(cfg.mediaRoot);
}

// --- menu -------------------------------------------------------------

function buildMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "File",
        submenu: [
          { label: "Change Media Folder…", click: changeFolderAndScan },
          { label: "Rescan Current Folder", click: rescan },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      {
        label: "View",
        submenu: [
          { label: "Home", accelerator: "Alt+Home", click: () => win && win.loadURL(baseUrl) },
          { role: "reload" },
          { role: "togglefullscreen" },
          { role: "toggleDevTools" },
        ],
      },
    ])
  );
}

// --- boot ------------------------------------------------------------

async function boot() {
  db = openDb(DB_PATH);
  const { port } = await createServer(db, RENDERER_DIR);
  baseUrl = `http://127.0.0.1:${port}`;

  win = new BrowserWindow({
    width: 1280,
    height: 820,
    backgroundColor: "#141414",
    title: "TV Center",
    autoHideMenuBar: false,
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });

  // External links open in the real browser, not inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  buildMenu();
  showLoading();

  // Cover page on every launch: continue with the saved folder or pick another.
  win.loadFile(path.join(__dirname, "welcome.html"));
}

/** Open the library for the saved folder (instantly if already scanned). */
function continueWithSavedFolder() {
  const { mediaRoot } = readConfig();
  if (!mediaRoot || !fs.existsSync(mediaRoot)) return false;
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM episodes").get();
  if (n === 0) {
    // Nothing saved yet: show the scan progress instead of an empty page.
    doScan(mediaRoot).catch(() => {});
  } else {
    win.loadURL(baseUrl);
    // Library opens instantly; refresh quietly for newly added episodes.
    doScan(mediaRoot, { silent: true }).catch(() => {});
  }
  return true;
}

ipcMain.handle("get-media-root", () => {
  const { mediaRoot } = readConfig();
  return mediaRoot ? { path: mediaRoot, available: fs.existsSync(mediaRoot) } : null;
});

ipcMain.handle("continue-folder", () => continueWithSavedFolder());

// Poster URLs for the cover page's background collage.
ipcMain.handle("get-posters", () =>
  db
    .prepare("SELECT poster_url FROM shows WHERE poster_url IS NOT NULL ORDER BY RANDOM() LIMIT 12")
    .all()
    .map((r) => r.poster_url)
);

// Called by the welcome screen's button. Returns true if a scan was started.
ipcMain.handle("choose-folder", async () => {
  if (scanning) return false;
  const folder = await pickFolder({ allowCancel: true });
  if (!folder) return false;
  writeConfig({ ...readConfig(), mediaRoot: folder });
  doScan(folder);
  return true;
});

app.whenReady().then(boot);
app.on("window-all-closed", () => app.quit());
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) boot();
});
