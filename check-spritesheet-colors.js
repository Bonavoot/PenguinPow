/**
 * Check the dominant color of spritesheet files to verify they're blue (not red)
 * Blue sprites should have dominant hue around 200-240
 * Red sprites should have dominant hue around 0-30 or 330-360
 */

const sharp = require('sharp');
const path = require('path');

const SPRITESHEETS_DIR = path.join(__dirname, 'client/src/assets/spritesheets');

const SPRITESHEETS_TO_CHECK = [
  'blocking2_spritesheet.png',
  'blocking_spritesheet.png',
  'pumo-waddle2_spritesheet.png',
  'hit2_spritesheet.png',
  'bow2_spritesheet.png',
  'grab-attempt2_spritesheet.png',
];

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

async function checkSpritesheet(filename) {
  const filepath = path.join(SPRITESHEETS_DIR, filename);
  
  try {
    // Get raw pixel data
    const { data, info } = await sharp(filepath)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Sample pixels and count colors in the blue/red hue ranges
    let bluePixels = 0;
    let redPixels = 0;
    let totalColoredPixels = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      // Skip transparent pixels
      if (a < 128) continue;
      
      const hsl = rgbToHsl(r, g, b);
      
      // Only count saturated, non-gray pixels
      if (hsl.s > 30 && hsl.l > 15 && hsl.l < 85) {
        totalColoredPixels++;
        
        // Blue range: 180-260
        if (hsl.h >= 180 && hsl.h <= 260) {
          bluePixels++;
        }
        // Red range: 0-30 or 330-360
        else if (hsl.h <= 30 || hsl.h >= 330) {
          redPixels++;
        }
      }
    }
    
    const bluePercent = totalColoredPixels > 0 ? (bluePixels / totalColoredPixels * 100).toFixed(1) : 0;
    const redPercent = totalColoredPixels > 0 ? (redPixels / totalColoredPixels * 100).toFixed(1) : 0;
    
    const dominantColor = bluePixels > redPixels ? 'BLUE' : 'RED';
    const isCorrect = filename.includes('2') ? dominantColor === 'BLUE' : dominantColor === 'RED';
    
    console.log(`${filename}:`);
    console.log(`  Blue pixels: ${bluePercent}%, Red pixels: ${redPercent}%`);
    console.log(`  Dominant: ${dominantColor} ${isCorrect ? '✓' : '✗ WRONG!'}`);
    console.log('');
    
    return { filename, bluePercent, redPercent, dominantColor, isCorrect };
  } catch (error) {
    console.log(`${filename}: Error - ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('Checking spritesheet colors...\n');
  console.log('Expected: Files with "2" should be BLUE, files without "2" should be RED\n');
  
  const results = [];
  for (const filename of SPRITESHEETS_TO_CHECK) {
    const result = await checkSpritesheet(filename);
    if (result) results.push(result);
  }
  
  const wrongFiles = results.filter(r => !r.isCorrect);
  if (wrongFiles.length > 0) {
    console.log('='.repeat(60));
    console.log('FILES WITH WRONG COLORS:');
    wrongFiles.forEach(f => console.log(`  - ${f.filename} (is ${f.dominantColor}, should be ${f.filename.includes('2') ? 'BLUE' : 'RED'})`));
  } else {
    console.log('All spritesheets have correct colors!');
  }
}

main().catch(console.error);
