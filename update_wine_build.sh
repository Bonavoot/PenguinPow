#!/bin/bash

# Quick update script for Wine build directory
# Run this after making any changes to your game

echo "🔄 Updating PenguinPow Wine build..."

# Step 1: Build the client
echo "1. Building client..."
npm run build:client

if [ $? -ne 0 ]; then
    echo "❌ Client build failed!"
    exit 1
fi

# Step 2: Clean stale files and copy fresh build to build_windows
echo "2. Cleaning old client dist and copying fresh build..."
rm -rf build_windows/win-unpacked/resources/app/client/dist
mkdir -p build_windows/win-unpacked/resources/app/client/dist
cp -r client/dist/* build_windows/win-unpacked/resources/app/client/dist/
cp main.js preload.js build_windows/win-unpacked/resources/app/

# Step 3: Copy to Wine directory
echo "3. Copying to Wine directory..."
./copy_to_windows_build.sh

echo ""
echo "✅ Wine build updated successfully!"
echo "Your C:\temp_penguinpow_build_windows directory now has the latest changes." 