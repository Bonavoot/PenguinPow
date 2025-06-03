#!/bin/bash

# Script to copy fixed files to Windows build directory
# Run this after rebuilding the client

WINDOWS_BUILD_DIR="/mnt/c/temp_penguinpow_build_windows"

echo "Copying fixed files to Windows build directory..."

# Check if Windows build directory exists
if [ ! -d "$WINDOWS_BUILD_DIR" ]; then
    echo "Error: Windows build directory not found at $WINDOWS_BUILD_DIR"
    echo "Please make sure the directory exists or update the path in this script"
    exit 1
fi

# Copy main.js with the path fix
echo "Copying main.js..."
cp main.js "$WINDOWS_BUILD_DIR/"

# Copy package.json with asar: false setting
echo "Copying package.json..."
cp package.json "$WINDOWS_BUILD_DIR/"

# Copy the entire client/dist directory
echo "Copying client/dist directory..."
if [ -d "client/dist" ]; then
    cp -r client/dist "$WINDOWS_BUILD_DIR/client/"
else
    echo "Error: client/dist directory not found. Please run 'npm run build:client' first"
    exit 1
fi

# Copy other important files
echo "Copying other files..."
cp preload.js "$WINDOWS_BUILD_DIR/" 2>/dev/null || echo "preload.js not found (might not be needed)"
cp steam_appid.txt "$WINDOWS_BUILD_DIR/" 2>/dev/null || echo "steam_appid.txt not found"

echo "✅ Files copied successfully!"
echo "Next steps:"
echo "1. Go to your Windows build directory: $WINDOWS_BUILD_DIR"
echo "2. Test the PenguinPow.exe to see if main menu images now work"
echo "3. If they work, re-upload to Steam using SteamPipe"

echo ""
echo "Files copied:"
echo "- main.js (with corrected path)"
echo "- client/dist/ (with new image implementation)"
echo "- preload.js (if exists)"
echo "- steam_appid.txt (if exists)" 