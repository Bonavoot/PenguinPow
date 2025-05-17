import { useState, useEffect } from "react";
import styled from "styled-components";
import PropTypes from "prop-types";

// Create a global volume state
let globalVolume = 1.0;

const SettingsContainer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.9);
  padding: 2rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
  z-index: 1000;
  width: 80%;
  max-width: 400px;
  backdrop-filter: blur(10px);
`;

const Title = styled.h2`
  color: white;
  font-family: "Bungee", cursive;
  margin-bottom: 1.5rem;
  text-align: center;
  font-size: 1.5rem;
`;

const ControlGroup = styled.div`
  margin-bottom: 1.5rem;
`;

const Label = styled.label`
  display: block;
  color: white;
  margin-bottom: 0.5rem;
  font-family: "Bungee", cursive;
  font-size: 1rem;
`;

const Slider = styled.input`
  width: 100%;
  height: 8px;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  outline: none;
  margin: 0.5rem 0;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    background: #ff4444;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      transform: scale(1.1);
    }
  }
`;

const Value = styled.span`
  color: white;
  font-size: 0.9rem;
  margin-left: 0.5rem;
`;

const Button = styled.button`
  background: linear-gradient(145deg, #ff4444, #cc0000);
  border: none;
  border-radius: 8px;
  padding: 0.8rem 1.5rem;
  font-size: 1rem;
  color: white;
  font-family: "Bungee", cursive;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 100%;
  margin-top: 1rem;

  &:hover {
    transform: translateY(-2px);
    background: linear-gradient(145deg, #ff6666, #ff0000);
  }

  &:active {
    transform: translateY(0);
  }
`;

const Settings = ({ onClose }) => {
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [volume, setVolume] = useState(100);

  useEffect(() => {
    // Apply the filters to the entire game window
    const gameWindow = document.querySelector(".current-page");
    if (gameWindow) {
      gameWindow.style.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    }
  }, [brightness, contrast]);

  useEffect(() => {
    // Update global volume when local volume changes
    globalVolume = volume / 100;
  }, [volume]);

  const handleReset = () => {
    setBrightness(100);
    setContrast(100);
    setVolume(100);
  };

  return (
    <SettingsContainer>
      <Title>Display Settings</Title>
      <ControlGroup>
        <Label>Brightness</Label>
        <Slider
          type="range"
          min="50"
          max="150"
          value={brightness}
          onChange={(e) => setBrightness(Number(e.target.value))}
        />
        <Value>{brightness}%</Value>
      </ControlGroup>
      <ControlGroup>
        <Label>Contrast</Label>
        <Slider
          type="range"
          min="50"
          max="150"
          value={contrast}
          onChange={(e) => setContrast(Number(e.target.value))}
        />
        <Value>{contrast}%</Value>
      </ControlGroup>
      <ControlGroup>
        <Label>Volume</Label>
        <Slider
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
        />
        <Value>{volume}%</Value>
      </ControlGroup>
      <Button onClick={handleReset}>Reset to Default</Button>
      <Button
        onClick={onClose}
        style={{
          marginTop: "0.5rem",
          background: "linear-gradient(145deg, #666666, #333333)",
        }}
      >
        Close
      </Button>
    </SettingsContainer>
  );
};

Settings.propTypes = {
  onClose: PropTypes.func.isRequired,
};

// Export the global volume getter
export const getGlobalVolume = () => globalVolume;

export default Settings;
