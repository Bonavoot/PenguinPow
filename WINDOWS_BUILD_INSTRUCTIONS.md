# Windows Build Instructions

## Problem
The PenguinPow.exe timestamp shows it's not updated with our latest fixes.

## Solution: Complete Windows Build

### Requirements
- Windows machine with Node.js installed
- Git (to clone/download the code)

### Steps

#### 1. Get Latest Code
Either:
- **Copy the entire PenguinPow project folder** from WSL to Windows
- Or **download/clone the repo** on Windows machine

#### 2. Install Dependencies
```cmd
cd PenguinPow
npm install
cd client
npm install
cd ..
```

#### 3. Build Client
```cmd
npm run build:client
```

#### 4. Build Windows Executable
```cmd
npx electron-builder --win --dir
```

This creates: `dist/win-unpacked/PenguinPow.exe`

#### 5. Copy to Steam Build Directory
```cmd
xcopy /E /I "dist\win-unpacked\*" "C:\temp_penguinpow_build_windows\"
```

#### 6. Upload to Steam
Use SteamPipe as usual.

## Alternative: Try Cache Clear First

Before full rebuild, try clearing Electron cache:

1. **Delete browser cache** in the app data
2. **Force restart** the .exe
3. **Check if main.js is actually being loaded** with our path fix

## Files to Verify Were Updated
- `main.js` - should have the path fix (`client/dist/index.html`)
- `client/dist/assets/index-64b4508d.js` - should have our image debugging code
- `client/dist/assets/main-menu-bkg-*.png` - the background images

## Debug Steps
1. **Run PenguinPow.exe**
2. **Press F12** to open dev tools
3. **Look for console messages**:
   ```
   Main menu background image source: [path]
   ✅ Main menu background image loaded successfully
   ```
4. **Check Network tab** - are the image files being requested? 