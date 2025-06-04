#!/bin/bash

# Script to copy the complete Windows build to Windows build directory
# Run this after updating the build_windows directory with latest changes

WINDOWS_BUILD_DIR="/mnt/c/temp_penguinpow_build_windows"

echo "Copying updated Windows build to Wine directory..."

# Check if Windows build directory exists
if [ ! -d "$WINDOWS_BUILD_DIR" ]; then
    echo "Error: Windows build directory not found at $WINDOWS_BUILD_DIR"
    echo "Please make sure the directory exists or update the path in this script"
    exit 1
fi

# Check if the Windows build exists
if [ ! -d "build_windows/win-unpacked" ]; then
    echo "Error: Windows build not found at build_windows/win-unpacked"
    echo "Please make sure the build_windows directory exists with the win-unpacked folder"
    exit 1
fi

# Clear the existing build directory (optional - remove if you want to keep existing files)
echo "Clearing existing Wine build directory..."
rm -rf "$WINDOWS_BUILD_DIR"/*

# Copy the entire Windows build
echo "Copying complete Windows build with updated fullscreen functionality..."
cp -r build_windows/win-unpacked/* "$WINDOWS_BUILD_DIR/"

echo "✅ Complete Windows build copied successfully to Wine directory!"
echo "Updated files include:"
echo "- PenguinPow.exe (the main executable)"
echo "- Updated main.js with fullscreen support"
echo "- Updated preload.js with settings API"
echo "- Updated client with new Settings component"
echo "- All Electron runtime files and dependencies"

echo ""
echo "🎮 New Features Added:"
echo "- Game launches in fullscreen by default"
echo "- Settings menu includes Display Mode options"
echo "- Windowed mode with custom resolution selection"
echo "- All settings are saved and restored between sessions"

echo ""
echo "Next steps:"
echo "1. Go to your Windows build directory: $WINDOWS_BUILD_DIR"
echo "2. Test the PenguinPow.exe to verify fullscreen functionality"
echo "3. Check Settings menu for new display options"
echo "4. If everything works correctly, re-upload to Steam using SteamPipe" 