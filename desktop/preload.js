"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tvcenter", {
  onStatus: (cb) => ipcRenderer.on("status", (_e, line) => cb(line)),
  getMediaRoot: () => ipcRenderer.invoke("get-media-root"),
  continueFolder: () => ipcRenderer.invoke("continue-folder"),
  getPosters: () => ipcRenderer.invoke("get-posters"),
  chooseFolder: () => ipcRenderer.invoke("choose-folder"),
});
