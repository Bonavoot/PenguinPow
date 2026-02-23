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
    
    # Extract frames using ffmpeg (force rgba to preserve transparency)
    ffmpeg -y -i "$input_file" -vsync 0 -pix_fmt rgba "$frame_dir/frame_%04d.png" 2>/dev/null
    
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
    
    # APNG default image fix: if first two frames are identical, remove the first
    # (APNG format includes a default/fallback image that ffmpeg extracts as an extra frame)
    if [ "$frame_count" -gt 1 ]; then
        local first=$(ls "$frame_dir"/*.png | head -1)
        local second=$(ls "$frame_dir"/*.png | head -2 | tail -1)
        if [ "$(md5sum "$first" | cut -d' ' -f1)" = "$(md5sum "$second" | cut -d' ' -f1)" ]; then
            echo "  Removing duplicate APNG default image (frame 1 == frame 2)"
            rm "$first"
            # Re-number frames sequentially
            local idx=1
            for f in "$frame_dir"/*.png; do
                mv "$f" "$frame_dir/renum_$(printf '%04d' $idx).png"
                idx=$((idx + 1))
            done
            for f in "$frame_dir"/renum_*.png; do
                local num=$(echo "$f" | grep -o '[0-9]\{4\}')
                mv "$f" "$frame_dir/frame_${num}.png"
            done
            frame_count=$((frame_count - 1))
            echo "  Adjusted to $frame_count frames"
        fi
    fi
    
    # Get frame dimensions from first frame
    local first_frame=$(ls "$frame_dir"/*.png | head -1)
    local dimensions=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$first_frame" 2>/dev/null)
    local width=$(echo $dimensions | cut -d'x' -f1)
    local height=$(echo $dimensions | cut -d'x' -f2)
    
    echo "  Frame size: ${width}x${height}"
    
    # Create horizontal spritesheet using ffmpeg tile filter
    # tile=NxM where N=columns, M=rows. For horizontal: Nx1
    ffmpeg -y -i "$frame_dir/frame_%04d.png" -filter_complex "tile=${frame_count}x1" -pix_fmt rgba "$OUTPUT_DIR/${base_name}_spritesheet.png" 2>/dev/null
    
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

# List of APNGs to convert
APNG_FILES=(
    "$ASSETS_DIR/blocking.png"
    "$ASSETS_DIR/bow.png"
    "$ASSETS_DIR/grab-attempt.png"
    "$ASSETS_DIR/hit.png"
    "$ASSETS_DIR/pumo-army.png"
    "$ASSETS_DIR/pumo-waddle.png"
    "$ASSETS_DIR/snowball-throw.png"
    "$ASSETS_DIR/at-the-ropes.png"
    "$ASSETS_DIR/crouch-strafing.png"
    "$ASSETS_DIR/is_perfect_parried.png"
    "$ASSETS_DIR/salt.png"
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
