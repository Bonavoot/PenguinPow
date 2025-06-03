# Steam Main Menu Images Fix

## Problem
Main menu background images not showing when PenguinPow is launched from Steam (but work when launched directly from .exe).

## Root Cause
1. **CSS background images in styled-components** use `url()` paths that don't resolve properly in Electron builds
2. **Working directory differences** between Steam launch vs direct .exe launch

## Solution Applied

### 1. Fixed main.js Path Loading
**File:** `main.js`
**Change:** Line 22-23
```javascript
// OLD (incorrect)
mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));

// NEW (correct) 
const indexPath = path.join(__dirname, "client", "dist", "index.html");
mainWindow.loadFile(indexPath);
```

### 2. Replaced CSS Background Images with IMG Elements
**File:** `client/src/components/MainMenu.jsx`

**Removed:** CSS `url()` backgrounds from styled-components
```javascript
// REMOVED - these don't work reliably in Electron
background: url(${mainMenuBackground});
url(${mainMenuBackground2});
url(${mainMenuBackground3});
```

**Added:** Regular `<img>` elements with cycling
```javascript
// NEW - reliable img elements
const BackgroundImage = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
  opacity: ${props => props.$isVisible ? 1 : 0};
  transition: opacity 1s ease-in-out;
  pointer-events: none;
`;

// In render function:
{backgroundImages.map((bgImage, index) => (
  <BackgroundImage
    key={index}
    src={bgImage}
    alt={`Background ${index + 1}`}
    $isVisible={index === currentBgIndex}
  />
))}
```

## Files to Update in Windows Build

1. **main.js** - Contains path fix
2. **client/dist/** - Contains new image implementation (after rebuild)
3. **preload.js** - If it exists
4. **steam_appid.txt** - Steam configuration

## Steps to Apply Fix

1. **Rebuild client:**
   ```bash
   cd client && npm run build
   ```

2. **Copy files to Windows build directory:**
   ```bash
   ./copy_to_windows_build.sh
   ```
   
   Or manually copy:
   - `main.js` → `C:\temp_penguinpow_build_windows\main.js`
   - `client/dist/` → `C:\temp_penguinpow_build_windows\client\`

3. **Test locally:**
   - Run `PenguinPow.exe` directly
   - Verify main menu images appear

4. **Re-upload to Steam:**
   - Use SteamPipe to upload the fixed build
   - Test from Steam launch

## Why This Fix Works

- **IMG elements** use Vite's asset processing which creates proper relative paths at build time
- **Path.join(__dirname)** creates absolute paths that work regardless of working directory
- **No dependency on CSS url() path resolution** which varies between environments

## Expected Result

Main menu will show cycling background images:
- Image 1 → Image 2 → Image 3 → Image 1 (every 10 seconds)
- Works from both Steam launch and direct .exe launch 