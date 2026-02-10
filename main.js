const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");
const fs = require("fs");

// Check if we're in development mode
const isDev = !app.isPackaged;

// Enable hardware acceleration
app.disableHardwareAcceleration = false;

// Settings file path
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

// Default settings
const defaultSettings = {
  displayMode: 'fullscreen', // 'fullscreen', 'windowed', 'maximized'
  windowWidth: 1920,
  windowHeight: 1080,
  brightness: 100,
  contrast: 100,
  volume: 100
};

// Load settings from file
function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      return { ...defaultSettings, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  return defaultSettings;
}

// Save settings to file
function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

let mainWindow;

function createWindow() {
  const settings = loadSettings();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // Calculate window dimensions
  let windowOptions = {
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      // Enable hardware acceleration
      enableWebGL: true,
      enableAcceleratedLayers: true,
      enableAccelerated2dCanvas: true,
    },
    // Add performance settings
    backgroundColor: "#000000",
    show: false, // Don't show until ready
    icon: process.platform !== 'darwin' ? path.join(__dirname, 'assets/icon.png') : undefined,
    titleBarStyle: 'hidden',
    frame: false, // Remove window frame for fullscreen experience
  };

  // Set window size based on display mode
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

  mainWindow = new BrowserWindow(windowOptions);

  // Apply display mode after window creation
  if (settings.displayMode === 'maximized') {
    mainWindow.maximize();
  }

  // Optimize for performance
  mainWindow.setBackgroundThrottling(false);

  // Show window when ready to prevent white flash
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    
    // Set fullscreen after showing if needed
    if (settings.displayMode === 'fullscreen') {
      mainWindow.setFullScreen(true);
    }
  });

  // Load the app
  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL("http://localhost:5173");
    // mainWindow.webContents.openDevTools();
  } else {
    // In production, load from built client files
    // Use absolute path to ensure it works regardless of working directory
    const indexPath = path.join(__dirname, "client", "dist", "index.html");
    console.log("Loading from:", indexPath);
    console.log("Process cwd:", process.cwd());
    console.log("__dirname:", __dirname);
    mainWindow.loadFile(indexPath);
  }
}

// IPC handlers for settings
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
  
  // Apply the new display mode
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
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
