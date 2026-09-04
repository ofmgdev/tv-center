"use strict";

/**
 * TV Center desktop shell.
 *
 * On launch:
 *   1. Load the saved media folder (data/config.json). If there isn't one,
 *      show a native "choose folder" dialog.
 *   2. Start the API server (server/) and the Vite dev server (frontend/).
 *   3. Run the Python scanner against the chosen folder, streaming its
 *      output onto the loading screen.
 *   4. When the frontend is up, load it in the window.
 *
 * "File -> Change Media Folder..." re-runs the picker + scan.
 * "File -> Rescan Current Folder" re-runs the scan without the picker.
 */

const { app, BrowserWindow, dialog, Menu, ipcMain } = require("electron");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");

const PROJECT_ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");
const DB_PATH = path.join(DATA_DIR, "db.sqlite");

const SERVER_DIR = path.join(PROJECT_ROOT, "server");
const FRONTEND_DIR = path.join(PROJECT_ROOT, "frontend");
const PYTHON_DIR = path.join(PROJECT_ROOT, "python");
const PYTHON_BIN = path.join(
  PYTHON_DIR,
  "venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python"
);

const FRONTEND_URL = "http://localhost:5173";
const API_PORT = 4000;

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

/** @type {BrowserWindow | null} */
let win = null;
/** @type {import('node:child_process').ChildProcess[]} */
const children = [];
let scanning = false;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

// ---------------------------------------------------------------------------
// Loading screen helpers
// ---------------------------------------------------------------------------

function showLoading() {
  if (win) win.loadFile(path.join(__dirname, "loading.html"));
}

function status(line) {
  if (win && !win.isDestroyed()) {
    win.webContents.send("status", line);
  }
  process.stdout.write(line + "\n");
}

// ---------------------------------------------------------------------------
// Child processes
// ---------------------------------------------------------------------------

function startBackgroundServers() {
  const env = { ...process.env, DB_PATH, PORT: String(API_PORT) };

  const api = spawn(npmCmd, ["run", "dev"], {
    cwd: SERVER_DIR,
    env,
    shell: process.platform === "win32",
  });
  api.stdout.on("data", (d) => process.stdout.write(`[api] ${d}`));
  api.stderr.on("data", (d) => process.stderr.write(`[api] ${d}`));
  children.push(api);

  const web = spawn(npmCmd, ["run", "dev"], {
    cwd: FRONTEND_DIR,
    env,
    shell: process.platform === "win32",
  });
  web.stdout.on("data", (d) => process.stdout.write(`[web] ${d}`));
  web.stderr.on("data", (d) => process.stderr.write(`[web] ${d}`));
  children.push(web);
}

function runScan(mediaRoot) {
  return new Promise((resolve) => {
    if (!fs.existsSync(PYTHON_BIN)) {
      status(
        `WARNING: Python venv not found at ${PYTHON_BIN}. Skipping scan — ` +
          `open a terminal in python/ and set it up (see README).`
      );
      return resolve();
    }

    scanning = true;
    status(`Scanning: ${mediaRoot}`);
    status("This can take a while the first time (fetching posters)...\n");

    const scan = spawn(PYTHON_BIN, ["scan.py"], {
      cwd: PYTHON_DIR,
      env: { ...process.env, MEDIA_ROOT: mediaRoot, DB_PATH, PYTHONIOENCODING: "utf-8" },
    });
    scan.stdout.on("data", (d) => String(d).split("\n").forEach((l) => l && status(l)));
    scan.stderr.on("data", (d) => status(String(d).trim()));
    scan.on("close", (code) => {
      scanning = false;
      status(`\nScan finished (exit ${code}).`);
      resolve();
    });
    scan.on("error", (err) => {
      scanning = false;
      status(`Scan failed to start: ${err.message}`);
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Wait for the frontend dev server, then load it
// ---------------------------------------------------------------------------

function waitForFrontend(timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(FRONTEND_URL, (res) => {
        res.destroy();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) return reject(new Error("frontend timeout"));
        setTimeout(tick, 500);
      });
    };
    tick();
  });
}

async function openLibrary() {
  status("Waiting for the frontend to start...");
  try {
    await waitForFrontend();
  } catch {
    status("Frontend did not come up in time — check the terminal for errors.");
    return;
  }
  if (win && !win.isDestroyed()) win.loadURL(FRONTEND_URL);
}

// ---------------------------------------------------------------------------
// Picker + scan flow
// ---------------------------------------------------------------------------

async function chooseFolder({ allowCancel }) {
  const result = await dialog.showOpenDialog(win, {
    title: "Choose your TV shows folder",
    properties: ["openDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return allowCancel ? null : chooseFolder({ allowCancel });
  }
  return result.filePaths[0];
}

async function changeFolderAndScan() {
  if (scanning) return;
  const folder = await chooseFolder({ allowCancel: true });
  if (!folder) return;
  writeConfig({ ...readConfig(), mediaRoot: folder });
  showLoading();
  await runScan(folder);
  await openLibrary();
}

async function rescan() {
  if (scanning) return;
  const cfg = readConfig();
  if (!cfg.mediaRoot) return changeFolderAndScan();
  showLoading();
  await runScan(cfg.mediaRoot);
  await openLibrary();
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

function buildMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        { label: "Change Media Folder…", click: changeFolderAndScan },
        { label: "Rescan Current Folder", click: rescan },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    { label: "View", submenu: [{ role: "reload" }, { role: "toggleDevTools" }, { role: "togglefullscreen" }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function boot() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    backgroundColor: "#141414",
    title: "TV Center",
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  buildMenu();
  showLoading();

  startBackgroundServers();

  let cfg = readConfig();
  if (!cfg.mediaRoot || !fs.existsSync(cfg.mediaRoot)) {
    const folder = await chooseFolder({ allowCancel: false });
    cfg = { ...cfg, mediaRoot: folder };
    writeConfig(cfg);
    await runScan(folder);
  } else {
    // Known folder: refresh in the background so new episodes show up.
    runScan(cfg.mediaRoot);
  }

  await openLibrary();
}

ipcMain.handle("get-media-root", () => readConfig().mediaRoot || null);

app.whenReady().then(boot);

app.on("window-all-closed", () => app.quit());

app.on("before-quit", () => {
  for (const c of children) {
    try {
      if (process.platform === "win32") spawn("taskkill", ["/pid", String(c.pid), "/f", "/t"]);
      else c.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
});
