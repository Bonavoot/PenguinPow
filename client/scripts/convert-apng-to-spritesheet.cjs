/**
 * APNG to Spritesheet Converter
 * 
 * This script converts APNG (Animated PNG) files into horizontal spritesheets
 * and generates metadata JSON files with frame information.
 * 
 * Usage: node convert-apng-to-spritesheet.js [input.png] [output.png]
 * Or run without args to convert all APNGs in the assets folder
 */

const fs = require('fs');
const path = require('path');

// We'll use a pure JS APNG parser
const APNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

/**
 * Parse PNG chunks from a buffer
 */
function parsePngChunks(buffer) {
  const chunks = [];
  let offset = 8; // Skip PNG signature
  
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.slice(offset + 4, offset + 8).toString('ascii');
    const data = buffer.slice(offset + 8, offset + 8 + length);
    const crc = buffer.readUInt32BE(offset + 8 + length);
    
    chunks.push({ type, data, crc, length });
    offset += 12 + length;
  }
  
  return chunks;
}

/**
 * Check if a PNG file is an APNG
 */
function isApng(filePath) {
  const buffer = fs.readFileSync(filePath);
  const chunks = parsePngChunks(buffer);
  return chunks.some(chunk => chunk.type === 'acTL');
}

/**
 * Get APNG frame info
 */
function getApngInfo(filePath) {
  const buffer = fs.readFileSync(filePath);
  const chunks = parsePngChunks(buffer);
  
  let width = 0, height = 0, numFrames = 0, numPlays = 0;
  const frameDelays = [];
  
  for (const chunk of chunks) {
    if (chunk.type === 'IHDR') {
      width = chunk.data.readUInt32BE(0);
      height = chunk.data.readUInt32BE(4);
    } else if (chunk.type === 'acTL') {
      numFrames = chunk.data.readUInt32BE(0);
      numPlays = chunk.data.readUInt32BE(4);
    } else if (chunk.type === 'fcTL') {
      const delayNum = chunk.data.readUInt16BE(20);
      const delayDen = chunk.data.readUInt16BE(22) || 100;
      const delayMs = Math.round((delayNum / delayDen) * 1000);
      frameDelays.push(delayMs);
    }
  }
  
  // Calculate FPS from average delay
  const avgDelay = frameDelays.length > 0 
    ? frameDelays.reduce((a, b) => a + b, 0) / frameDelays.length 
    : 100;
  const fps = Math.round(1000 / avgDelay);
  
  return {
    width,
    height,
    numFrames,
    numPlays,
    frameDelays,
    fps,
    totalDuration: frameDelays.reduce((a, b) => a + b, 0)
  };
}

/**
 * List all APNG files in a directory
 */
function findApngFiles(directory) {
  const files = fs.readdirSync(directory);
  const apngFiles = [];
  
  for (const file of files) {
    if (file.endsWith('.png')) {
      const fullPath = path.join(directory, file);
      try {
        if (isApng(fullPath)) {
          const info = getApngInfo(fullPath);
          apngFiles.push({
            file,
            path: fullPath,
            ...info
          });
        }
      } catch (e) {
        // Skip files that can't be parsed
      }
    }
  }
  
  return apngFiles;
}

// Main execution
const assetsDir = path.join(__dirname, '../src/assets');

console.log('Scanning for APNG files in:', assetsDir);
console.log('');

const apngFiles = findApngFiles(assetsDir);

console.log(`Found ${apngFiles.length} APNG files:\n`);

// Group by base name (without 2 suffix) to show pairs
const groups = {};
for (const apng of apngFiles) {
  // Skip old/backup files
  if (apng.file.includes('-old') || apng.file.includes('_old')) continue;
  
  const baseName = apng.file.replace(/2?\.png$/, '').replace(/-/g, '_');
  if (!groups[baseName]) groups[baseName] = [];
  groups[baseName].push(apng);
}

for (const [baseName, files] of Object.entries(groups)) {
  console.log(`📦 ${baseName}:`);
  for (const apng of files) {
    console.log(`   ${apng.file}: ${apng.numFrames} frames, ${apng.width}x${apng.height}, ~${apng.fps} fps`);
  }
  console.log('');
}

// Generate conversion commands for ffmpeg
console.log('\n=== FFmpeg Conversion Commands ===\n');
console.log('Run these commands to extract frames, then use ImageMagick/sharp to create spritesheets:\n');

for (const apng of apngFiles) {
  if (apng.file.includes('-old') || apng.file.includes('_old')) continue;
  
  const outputBase = apng.file.replace('.png', '');
  console.log(`# ${apng.file} (${apng.numFrames} frames)`);
  console.log(`ffmpeg -i "${apng.path}" -vsync 0 "${assetsDir}/temp_frames/${outputBase}_%03d.png"`);
  console.log('');
}

// Output JSON metadata for the game to use
const metadata = {};
for (const apng of apngFiles) {
  if (apng.file.includes('-old') || apng.file.includes('_old')) continue;
  
  const key = apng.file.replace('.png', '').replace(/-/g, '_');
  metadata[key] = {
    originalFile: apng.file,
    frameCount: apng.numFrames,
    frameWidth: apng.width,
    frameHeight: apng.height,
    fps: apng.fps,
    totalDuration: apng.totalDuration
  };
}

const metadataPath = path.join(__dirname, 'apng-metadata.json');
fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
console.log(`\nMetadata saved to: ${metadataPath}`);
