#!/bin/bash
# Convert all APNGs to horizontal spritesheets using ffmpeg

ASSETS_DIR="../src/assets"
TEMP_DIR="./temp_frames"
OUTPUT_DIR="../src/assets/spritesheets"

# Create directories
mkdir -p "$TEMP_DIR"
mkdir -p "$OUTPUT_DIR"

# Function to convert a single APNG to spritesheet
convert_apng() {
    local input_file="$1"
    local base_name=$(basename "$input_file" .png)
    local frame_dir="$TEMP_DIR/$base_name"
    
    echo "Converting: $base_name"
    
    # Create temp directory for frames
    mkdir -p "$frame_dir"
    
    # Extract frames using ffmpeg
    ffmpeg -y -i "$input_file" -vsync 0 "$frame_dir/frame_%04d.png" 2>/dev/null
    
    if [ $? -ne 0 ]; then
        echo "  Error extracting frames from $input_file"
        return 1
    fi
    
    # Count frames
    local frame_count=$(ls -1 "$frame_dir"/*.png 2>/dev/null | wc -l)
    
    if [ "$frame_count" -eq 0 ]; then
        echo "  No frames extracted"
        return 1
    fi
    
    echo "  Extracted $frame_count frames"
    
    # Get frame dimensions from first frame
    local first_frame=$(ls "$frame_dir"/*.png | head -1)
    local dimensions=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$first_frame" 2>/dev/null)
    local width=$(echo $dimensions | cut -d'x' -f1)
    local height=$(echo $dimensions | cut -d'x' -f2)
    
    echo "  Frame size: ${width}x${height}"
    
    # Create horizontal spritesheet using ffmpeg tile filter
    # tile=NxM where N=columns, M=rows. For horizontal: Nx1
    ffmpeg -y -i "$frame_dir/frame_%04d.png" -filter_complex "tile=${frame_count}x1" "$OUTPUT_DIR/${base_name}_spritesheet.png" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "  Created: ${base_name}_spritesheet.png (${frame_count} frames, ${width}x${height} each)"
        
        # Output metadata
        echo "{\"frameCount\": $frame_count, \"frameWidth\": $width, \"frameHeight\": $height}" > "$OUTPUT_DIR/${base_name}_spritesheet.json"
    else
        echo "  Error creating spritesheet"
        return 1
    fi
    
    # Cleanup temp frames
    rm -rf "$frame_dir"
}

cd "$(dirname "$0")"

echo "=== APNG to Spritesheet Converter ==="
echo ""

# List of APNGs to convert (from metadata)
APNG_FILES=(
    "$ASSETS_DIR/blocking.png"
    "$ASSETS_DIR/blocking2.png"
    "$ASSETS_DIR/bow.png"
    "$ASSETS_DIR/bow2.png"
    "$ASSETS_DIR/grab-attempt.png"
    "$ASSETS_DIR/grab-attempt2.png"
    "$ASSETS_DIR/hit2.png"
    "$ASSETS_DIR/pumo-army.png"
    "$ASSETS_DIR/pumo-army2.png"
    "$ASSETS_DIR/pumo-waddle.png"
    "$ASSETS_DIR/pumo-waddle2.png"
    "$ASSETS_DIR/snowball-throw.png"
    "$ASSETS_DIR/snowball-throw2.png"
    "$ASSETS_DIR/at-the-ropes2.png"
    "$ASSETS_DIR/crouch-strafing2.png"
)

for apng in "${APNG_FILES[@]}"; do
    if [ -f "$apng" ]; then
        convert_apng "$apng"
        echo ""
    else
        echo "File not found: $apng"
    fi
done

# Cleanup temp directory
rm -rf "$TEMP_DIR"

echo "=== Conversion Complete ==="
echo ""
echo "Spritesheets saved to: $OUTPUT_DIR"
echo ""
echo "Next steps:"
echo "1. Update imports in GameFighter.jsx to use new spritesheets"
echo "2. Use the AnimatedSprite component for playback"
