/**
 * Resize oversized icon/effect images to reduce memory usage
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ASSETS_DIR = path.join(__dirname, 'client/src/assets');

// Icons/effects to resize: [filename, targetSize]
const IMAGES_TO_RESIZE = [
  ['thick-blubber-icon.png', 256],
  ['power-water.png', 256],
  ['hit-effect.png', 256],
  ['happy-feet.png', 256],
  ['pumo-army-icon.png', 128], // If it exists
  ['snowball.png', 128],       // Snowball projectile
];

async function resizeImage(filename, targetSize) {
  const inputPath = path.join(ASSETS_DIR, filename);
  
  if (!fs.existsSync(inputPath)) {
    // Try in components folder
    const altPath = path.join(ASSETS_DIR, '../components', filename);
    if (!fs.existsSync(altPath)) {
      console.log(`  Skipping ${filename} (not found)`);
      return false;
    }
  }
  
  const actualPath = fs.existsSync(inputPath) ? inputPath : path.join(ASSETS_DIR, '../components', filename);
  
  const metadata = await sharp(actualPath).metadata();
  
  // Skip if already small enough
  if (metadata.width <= targetSize && metadata.height <= targetSize) {
    console.log(`  Skipping ${filename} - already small (${metadata.width}x${metadata.height})`);
    return false;
  }
  
  console.log(`  ${filename}: ${metadata.width}x${metadata.height} -> max ${targetSize}px`);
  
  // Backup
  const backupPath = actualPath.replace('.png', '_backup_original.png');
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(actualPath, backupPath);
  }
  
  // Resize maintaining aspect ratio
  await sharp(actualPath)
    .resize(targetSize, targetSize, {
      fit: 'inside',
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 9 })
    .toFile(actualPath + '.tmp');
  
  fs.unlinkSync(actualPath);
  fs.renameSync(actualPath + '.tmp', actualPath);
  
  const newMeta = await sharp(actualPath).metadata();
  const oldSize = fs.statSync(backupPath).size;
  const newSize = fs.statSync(actualPath).size;
  console.log(`    -> ${newMeta.width}x${newMeta.height}, ${(oldSize/1024).toFixed(0)}KB -> ${(newSize/1024).toFixed(0)}KB`);
  
  return true;
}

async function main() {
  console.log('Resizing oversized icons and effects...\n');
  
  let resized = 0;
  for (const [filename, targetSize] of IMAGES_TO_RESIZE) {
    try {
      if (await resizeImage(filename, targetSize)) {
        resized++;
      }
    } catch (error) {
      console.log(`  Error with ${filename}: ${error.message}`);
    }
  }
  
  console.log(`\nDone! Resized ${resized} images.`);
}

main().catch(console.error);
