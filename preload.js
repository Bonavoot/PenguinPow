const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
  send: (channel, data) => {
    // whitelist channels
    let validChannels = ["toMain"];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  receive: (channel, func) => {
    let validChannels = ["fromMain"];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  // Settings and display management
  settings: {
    get: () => ipcRenderer.invoke('get-settings'),
    save: (settings) => ipcRenderer.invoke('save-settings', settings),
    setDisplayMode: (mode, width, height) => ipcRenderer.invoke('set-display-mode', mode, width, height),
    getScreenInfo: () => ipcRenderer.invoke('get-screen-info')
  },
  // BASHO single-player save file (basho-save.json in userData).
  // Returns the raw document; renderer (saveStore.js) owns schema/migrations.
  save: {
    get: () => ipcRenderer.invoke('load-save'),
    write: (data) => ipcRenderer.invoke('write-save', data)
  }
});
