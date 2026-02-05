/**
 * ColorPicker - Component for selecting player costume colors
 * 
 * Provides a simple UI for players to choose their mawashi/headband color.
 * This integrates with the sprite recoloring system.
 */

import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import {
  recolorImage,
  BLUE_COLOR_RANGES,
  COLOR_PRESETS,
} from "../utils/SpriteRecolorizer";

// UNIFIED: Both players use BLUE sprite as preview
import pumo2 from "../assets/pumo2.png";

const PickerContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 15px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 10px;
  border: 2px solid #gold;
`;

const Title = styled.h3`
  color: #fff;
  margin: 0 0 10px 0;
  font-family: "Bungee", sans-serif;
  font-size: 14px;
  text-shadow: 2px 2px 0 #000;
`;

const PreviewContainer = styled.div`
  width: 80px;
  height: 80px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
`;

const PreviewImage = styled.img`
  max-width: 100%;
  max-height: 100%;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
`;

const ColorGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 5px;
  max-width: 180px;
`;

const ColorSwatch = styled.button`
  width: 30px;
  height: 30px;
  border-radius: 4px;
  border: 2px solid ${(props) => (props.$selected ? "#fff" : "transparent")};
  background-color: ${(props) => props.$color};
  cursor: pointer;
  transition: transform 0.1s, border-color 0.1s;
  box-shadow: ${(props) =>
    props.$selected ? "0 0 8px rgba(255, 255, 255, 0.8)" : "0 2px 4px rgba(0,0,0,0.3)"};

  &:hover {
    transform: scale(1.1);
    border-color: rgba(255, 255, 255, 0.5);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
`;

/**
 * ColorPicker component
 * 
 * @param {number} playerNumber - 1 or 2
 * @param {string} currentColor - Current selected color hex
 * @param {function} onColorChange - Callback when color changes (receives hex color)
 * @param {string} title - Optional title override
 */
function ColorPicker({
  playerNumber,
  currentColor,
  onColorChange,
  title = null,
}) {
  // UNIFIED: Both players use blue sprite as base - recoloring handles differentiation
  const [previewSrc, setPreviewSrc] = useState(pumo2);
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);

  const defaultColor = playerNumber === 1 ? COLOR_PRESETS.blue : COLOR_PRESETS.red;
  // All sprites are now blue - always use BLUE_COLOR_RANGES
  const colorRanges = BLUE_COLOR_RANGES;
  const baseSprite = pumo2;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Update preview when color changes
  // UNIFIED: Base sprite is blue, so we need to recolor if color is NOT blue
  useEffect(() => {
    // If no color selected or color is blue, show the base blue sprite
    if (!currentColor || currentColor === COLOR_PRESETS.blue) {
      setPreviewSrc(baseSprite);
      return;
    }

    // For any other color (including Player 2's default red), recolor the blue sprite
    setIsLoading(true);

    recolorImage(baseSprite, colorRanges, currentColor)
      .then((recolored) => {
        if (mountedRef.current) {
          setPreviewSrc(recolored);
        }
      })
      .catch((error) => {
        console.error("Failed to recolor preview:", error);
        if (mountedRef.current) {
          setPreviewSrc(baseSprite);
        }
      })
      .finally(() => {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      });
  }, [currentColor, colorRanges, baseSprite]);

  const displayTitle = title || `Player ${playerNumber} Color`;

  // Color options to display
  const colorOptions = [
    { name: "Blue", hex: COLOR_PRESETS.blue },
    { name: "Red", hex: COLOR_PRESETS.red },
    { name: "Pink", hex: COLOR_PRESETS.pink },
    { name: "Green", hex: COLOR_PRESETS.green },
    { name: "Purple", hex: COLOR_PRESETS.purple },
    { name: "Orange", hex: COLOR_PRESETS.orange },
    { name: "Cyan", hex: COLOR_PRESETS.cyan },
    { name: "Gold", hex: COLOR_PRESETS.gold },
    { name: "Teal", hex: COLOR_PRESETS.teal },
    { name: "Violet", hex: COLOR_PRESETS.violet },
  ];

  return (
    <PickerContainer>
      <Title>{displayTitle}</Title>
      <PreviewContainer>
        {isLoading && <LoadingOverlay>...</LoadingOverlay>}
        <PreviewImage src={previewSrc} alt="Preview" />
      </PreviewContainer>
      <ColorGrid>
        {colorOptions.map((color) => (
          <ColorSwatch
            key={color.name}
            $color={color.hex}
            $selected={currentColor === color.hex}
            onClick={() => onColorChange(color.hex)}
            title={color.name}
          />
        ))}
      </ColorGrid>
    </PickerContainer>
  );
}

/**
 * Dual color picker for both players
 */
export function DualColorPicker({
  player1Color,
  player2Color,
  onPlayer1ColorChange,
  onPlayer2ColorChange,
}) {
  return (
    <div style={{ display: "flex", gap: "20px" }}>
      <ColorPicker
        playerNumber={1}
        currentColor={player1Color}
        onColorChange={onPlayer1ColorChange}
        title="Player 1"
      />
      <ColorPicker
        playerNumber={2}
        currentColor={player2Color}
        onColorChange={onPlayer2ColorChange}
        title="Player 2"
      />
    </div>
  );
}

export default ColorPicker;
