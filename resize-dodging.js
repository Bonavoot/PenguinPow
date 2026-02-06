/**
 * Resize the dodging spritesheet from 1024x1024 frames to 480x480
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SPRITESHEETS_DIR = path.join(__dirname, 'client/src/assets/spritesheets');

async function main() {
  const filename = 'dodging_spritesheet.png';
  const inputPath = path.join(SPRITESHEETS_DIR, filename);
  
  // Get current dimensions
  const metadata = await sharp(inputPath).metadata();
  console.log(`Current: ${metadata.width}x${metadata.height}`);
  
  // Create backup
  const backupPath = inputPath.replace('.png', '_backup_1024.png');
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(inputPath, backupPath);
    console.log(`Created backup: ${path.basename(backupPath)}`);
  }
  
  // Resize from 4096x1024 (4 frames × 1024) to 1920x480 (4 frames × 480)
  const newWidth = 4 * 480;  // 1920
  const newHeight = 480;
  
  console.log(`Resizing to: ${newWidth}x${newHeight}`);
  
  await sharp(inputPath)
    .resize(newWidth, newHeight, {
      kernel: sharp.kernel.lanczos3,
      fit: 'fill',
    })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
    })
    .toFile(inputPath + '.tmp');
  
  fs.unlinkSync(inputPath);
  fs.renameSync(inputPath + '.tmp', inputPath);
  
  // Verify
  const newMetadata = await sharp(inputPath).metadata();
  console.log(`New: ${newMetadata.width}x${newMetadata.height}`);
  
  const oldSize = fs.statSync(backupPath).size;
  const newSize = fs.statSync(inputPath).size;
  console.log(`File size: ${(oldSize/1024).toFixed(0)}KB -> ${(newSize/1024).toFixed(0)}KB (${((1-newSize/oldSize)*100).toFixed(0)}% smaller)`);
}

main().catch(console.error);
