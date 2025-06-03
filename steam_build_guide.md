# Upload PenguinPow to Steam - Step by Step Guide

## Prerequisites
- ✅ Steam App ID: 3793530 
- ✅ Steamworks Partner Account access
- ✅ Game built with Windows executable

## ✅ UPDATED: Windows Build Ready!

**Use this build path**: `C:\temp_penguinpow_build_windows`

## Step 1: Download & Setup Steamworks SDK

1. Download Steamworks SDK from your [partner portal](https://partner.steamgames.com/)
2. Extract to: `C:\steamworks_sdk_161\` (or similar)
3. Navigate to: `C:\steamworks_sdk_161\sdk\tools\`

## Step 2: Use SteamPipe GUI (Recommended)

1. **Extract SteamPipeGUI.zip** in the tools folder
2. **Update Steam CLI**: Run `ContentBuilder\builder\steamcmd.exe` (let it update)
3. **Open SteamPipeGUI.exe** from the extracted folder

## Step 3: Configure Upload

In SteamPipeGUI:
- **Steam App ID**: `3793530`
- **Steam Login**: Your build account username
- **Local Path**: `C:\temp_penguinpow_build_windows`
- **Depot Path**: `*` (maps everything to root)

## Step 4: ⚠️ CRITICAL - Fix Launch Configuration

**AFTER UPLOAD**, in Steamworks Partner Portal:

1. Go to **Store & Steamworks > Application > Installation**
2. Set **Launch Options**:
   - **Executable**: `PenguinPow.exe`
   - **Arguments**: (leave blank)
   - **Operating System**: **Windows**
   - **Launch Type**: **Launch Executable**

## Step 5: Set Build Live

1. Go to **SteamPipe > Builds**
2. Find your new Windows build
3. Click **"Set build live on default branch"**

## Step 6: Test Installation

1. Restart Steam completely
2. Try installing your game again
3. Click "Play" - should launch properly now!

## 🎮 Your Game Should Now Launch From Steam!

The key fixes:
- ✅ Windows executable (`PenguinPow.exe`)
- ✅ Correct launch configuration
- ✅ Proper build structure

## Automation Script (Future uploads)

Create `upload_build.bat` in ContentBuilder folder:
```batch
builder\steamcmd.exe +login YOUR_USERNAME +run_app_build ..\scripts\app_3793530.vdf +quit
pause
```

## Notes
- First upload takes longest (full game)
- Future updates only upload changed files
- Build must be "set live" to appear in Steam
- You can create beta branches for testing

## Troubleshooting
- **"Account Login Denied"**: Check SteamGuard email
- **"Invalid content configuration"**: Verify executable path in dashboard
- **Build not appearing**: Make sure it's set live on default branch

## Your Game Is Now On Steam! 🎉 