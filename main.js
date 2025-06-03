const { app, BrowserWindow } = require("electron");
const path = require("path");

// Check if we're in development mode
const isDev = !app.isPackaged;

// Enable hardware acceleration
app.disableHardwareAcceleration = false;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
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
  });

  // Optimize for performance
  mainWindow.setBackgroundThrottling(false);

  // Show window when ready to prevent white flash
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Load the app
  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
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

app.whenReady().then(() => {
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
