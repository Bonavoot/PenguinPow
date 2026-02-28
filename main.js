const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

app.commandLine.appendSwitch('no-sandbox');

const isDev = !app.isPackaged;

const logLocations = [
  path.join(path.dirname(process.execPath), 'penguinpow-debug.log'),
  path.join(os.homedir(), 'Desktop', 'penguinpow-debug.log'),
  path.join(os.tmpdir(), 'penguinpow-debug.log'),
];
if (!isDev) {
  try { logLocations.push(path.join(app.getPath('userData'), 'penguinpow-debug.log')); } catch (_) {}
}

function debugLog(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  for (const p of logLocations) {
    try { fs.appendFileSync(p, line); } catch (_) {}
  }
}

debugLog('=== PenguinPow starting ===');
debugLog(`app.isPackaged: ${app.isPackaged}`);
debugLog(`isDev: ${isDev}`);
debugLog(`__dirname: ${__dirname}`);
debugLog(`process.execPath: ${process.execPath}`);
debugLog(`process.cwd(): ${process.cwd()}`);
debugLog(`process.platform: ${process.platform}`);
debugLog(`electron version: ${process.versions.electron}`);
debugLog(`chrome version: ${process.versions.chrome}`);
debugLog(`node version: ${process.versions.node}`);
debugLog(`logLocations: ${JSON.stringify(logLocations)}`);

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

const defaultSettings = {
  displayMode: 'fullscreen',
  windowWidth: 1920,
  windowHeight: 1080,
  brightness: 100,
  contrast: 100,
  volume: 100
};

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      return { ...defaultSettings, ...JSON.parse(data) };
    }
  } catch (error) {
    debugLog(`Error loading settings: ${error.message}`);
  }
  return defaultSettings;
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (error) {
    debugLog(`Error saving settings: ${error.message}`);
  }
}

let mainWindow;

function createWindow() {
  debugLog('createWindow called');
  const settings = loadSettings();
  debugLog(`Settings loaded: displayMode=${settings.displayMode}`);

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  debugLog(`Screen: ${screenWidth}x${screenHeight}`);

  let windowOptions = {
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    backgroundColor: "#000000",
    show: false,
    icon: process.platform !== 'darwin' ? path.join(__dirname, 'assets/icon.png') : undefined,
    titleBarStyle: 'hidden',
    frame: false,
  };

  switch (settings.displayMode) {
    case 'fullscreen':
      windowOptions.fullscreen = true;
      windowOptions.width = screenWidth;
      windowOptions.height = screenHeight;
      break;
    case 'maximized':
      windowOptions.width = screenWidth;
      windowOptions.height = screenHeight;
      break;
    case 'windowed':
    default:
      windowOptions.width = Math.min(settings.windowWidth, screenWidth);
      windowOptions.height = Math.min(settings.windowHeight, screenHeight);
      windowOptions.resizable = true;
      windowOptions.minimizable = true;
      windowOptions.maximizable = true;
      break;
  }

  debugLog(`Creating BrowserWindow...`);
  mainWindow = new BrowserWindow(windowOptions);

  if (settings.displayMode === 'maximized') {
    mainWindow.maximize();
  }

  mainWindow.setBackgroundThrottling(false);

  mainWindow.once("ready-to-show", () => {
    debugLog('ready-to-show fired');
    mainWindow.show();
    if (settings.displayMode === 'fullscreen') {
      mainWindow.setFullScreen(true);
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    debugLog('did-finish-load — page loaded successfully');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    debugLog(`[LOAD FAILED] ${errorDescription} (code: ${errorCode}) URL: ${validatedURL}`);
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    debugLog(`[Renderer ${level >= 2 ? 'ERROR' : 'LOG'}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    debugLog(`[RENDERER CRASHED] reason: ${details.reason}, exitCode: ${details.exitCode}`);
  });

  mainWindow.webContents.on('unresponsive', () => {
    debugLog('[UNRESPONSIVE] Renderer became unresponsive');
  });

  const indexPath = path.join(__dirname, "client", "dist", "index.html");
  const fileExists = fs.existsSync(indexPath);
  debugLog(`Index path: ${indexPath}`);
  debugLog(`Index exists: ${fileExists}`);

  if (fileExists) {
    debugLog('Loading from file...');
    mainWindow.loadFile(indexPath).then(() => {
      debugLog('loadFile resolved');
    }).catch((err) => {
      debugLog(`loadFile rejected: ${err.message}`);
    });
  } else if (isDev) {
    debugLog('File not found, loading dev server...');
    mainWindow.loadURL("http://localhost:5173");
  } else {
    debugLog('[FATAL] No index.html found and not in dev mode!');
    mainWindow.loadURL(`data:text/html,<h1 style="color:white;background:#000;padding:40px;font-family:sans-serif">PenguinPow Error: index.html not found at ${indexPath.replace(/\\/g, '\\\\')}</h1>`);
  }
}

ipcMain.handle('get-settings', () => {
  return loadSettings();
});

ipcMain.handle('save-settings', (event, newSettings) => {
  const settings = { ...loadSettings(), ...newSettings };
  saveSettings(settings);
  return settings;
});

ipcMain.handle('set-display-mode', (event, mode, width, height) => {
  if (!mainWindow) return;

  const settings = loadSettings();
  settings.displayMode = mode;

  if (width && height) {
    settings.windowWidth = width;
    settings.windowHeight = height;
  }

  saveSettings(settings);

  switch (mode) {
    case 'fullscreen':
      mainWindow.setFullScreen(true);
      break;
    case 'maximized':
      mainWindow.setFullScreen(false);
      mainWindow.maximize();
      break;
    case 'windowed':
      mainWindow.setFullScreen(false);
      mainWindow.unmaximize();
      if (width && height) {
        mainWindow.setSize(width, height);
        mainWindow.center();
      }
      break;
  }
});

ipcMain.handle('get-screen-info', () => {
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();

  return {
    displays: displays.map(display => ({
      id: display.id,
      bounds: display.bounds,
      workArea: display.workArea,
      scaleFactor: display.scaleFactor,
      isPrimary: display.id === primaryDisplay.id
    })),
    primaryDisplay: {
      id: primaryDisplay.id,
      bounds: primaryDisplay.bounds,
      workArea: primaryDisplay.workArea,
      scaleFactor: primaryDisplay.scaleFactor
    }
  };
});

app.whenReady().then(() => {
  debugLog('app ready');
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
