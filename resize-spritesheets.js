/**
 * Spritesheet Resizer
 * 
 * Resizes oversized 1024x1024 frame spritesheets to 480x480 frames
 * to match the other sprites and reduce memory usage by ~78%
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SPRITESHEETS_DIR = path.join(__dirname, 'client/src/assets/spritesheets');

// Spritesheets to resize: [filename, currentFrameSize, frameCount, targetFrameSize]
const SHEETS_TO_RESIZE = [
  ['pumo-waddle2_spritesheet.png', 1024, 21, 480],
  ['is-being-grabbed2_spritesheet.png', 1024, 2, 480],
  // Also resize the player1 versions if they exist
  ['pumo-waddle_spritesheet.png', 1024, 21, 480],
  ['is-being-grabbed_spritesheet.png', 1024, 2, 480],
];

async function resizeSpritesheet(filename, currentFrameSize, frameCount, targetFrameSize) {
  const inputPath = path.join(SPRITESHEETS_DIR, filename);
  
  // Check if file exists
  if (!fs.existsSync(inputPath)) {
    console.log(`  Skipping ${filename} (file not found)`);
    return false;
  }
  
  // Get image metadata to verify dimensions
  const metadata = await sharp(inputPath).metadata();
  const expectedWidth = currentFrameSize * frameCount;
  
  if (metadata.width !== expectedWidth || metadata.height !== currentFrameSize) {
    console.log(`  Skipping ${filename} - unexpected dimensions: ${metadata.width}x${metadata.height}`);
    console.log(`    Expected: ${expectedWidth}x${currentFrameSize}`);
    return false;
  }
  
  // Create backup
  const backupPath = inputPath.replace('.png', '_backup_1024.png');
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(inputPath, backupPath);
    console.log(`  Created backup: ${path.basename(backupPath)}`);
  }
  
  // Calculate new dimensions
  const newWidth = targetFrameSize * frameCount;
  const newHeight = targetFrameSize;
  
  console.log(`  Resizing: ${metadata.width}x${metadata.height} -> ${newWidth}x${newHeight}`);
  
  // Resize with high quality settings
  await sharp(inputPath)
    .resize(newWidth, newHeight, {
      kernel: sharp.kernel.lanczos3, // High quality downscaling
      fit: 'fill',
    })
    .png({
      compressionLevel: 9, // Max compression
      adaptiveFiltering: true,
    })
    .toFile(inputPath + '.tmp');
  
  // Replace original with resized version
  fs.unlinkSync(inputPath);
  fs.renameSync(inputPath + '.tmp', inputPath);
  
  // Get new file size
  const newStats = fs.statSync(inputPath);
  const oldStats = fs.statSync(backupPath);
  const sizeSavings = ((1 - newStats.size / oldStats.size) * 100).toFixed(1);
  
  console.log(`  File size: ${(oldStats.size / 1024).toFixed(0)}KB -> ${(newStats.size / 1024).toFixed(0)}KB (${sizeSavings}% smaller)`);
  
  return true;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Spritesheet Resizer - Optimizing oversized sprites');
  console.log('='.repeat(60));
  console.log('');
  
  let resized = 0;
  let skipped = 0;
  
  for (const [filename, currentSize, frameCount, targetSize] of SHEETS_TO_RESIZE) {
    console.log(`\nProcessing: ${filename}`);
    
    try {
      const success = await resizeSpritesheet(filename, currentSize, frameCount, targetSize);
      if (success) {
        resized++;
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`  Error: ${error.message}`);
      skipped++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`Done! Resized: ${resized}, Skipped: ${skipped}`);
  console.log('');
  console.log('Next steps:');
  console.log('1. Update spriteConfig.js frameWidth/frameHeight from 1024 to 480');
  console.log('2. Update animatedSpriteConfig.js frameWidth/frameHeight from 1024 to 480');
  console.log('3. Test the game to ensure sprites look correct');
  console.log('='.repeat(60));
}

main().catch(console.error);
