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
  max-width: 500px;
  backdrop-filter: blur(10px);
  max-height: 80vh;
  overflow-y: auto;
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

const Select = styled.select`
  width: 100%;
  padding: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-family: "Bungee", cursive;
  font-size: 0.9rem;
  outline: none;
  margin: 0.5rem 0;

  option {
    background: rgba(0, 0, 0, 0.9);
    color: white;
  }

  &:focus {
    border-color: #ff4444;
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

const ResolutionGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-top: 0.5rem;
`;

const ResolutionButton = styled.button`
  background: ${props => props.selected ? 
    'linear-gradient(145deg, #ff4444, #cc0000)' : 
    'linear-gradient(145deg, #444444, #222222)'};
  border: none;
  border-radius: 4px;
  padding: 0.5rem;
  font-size: 0.8rem;
  color: white;
  font-family: "Bungee", cursive;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    background: ${props => props.selected ? 
      'linear-gradient(145deg, #ff6666, #ff0000)' : 
      'linear-gradient(145deg, #555555, #333333)'};
  }
`;

// Common resolution options above 1920x1080
const resolutionOptions = [
  { width: 1920, height: 1080, label: "1920x1080" },
  { width: 2560, height: 1440, label: "2560x1440" },
  { width: 3440, height: 1440, label: "3440x1440" },
  { width: 3840, height: 2160, label: "3840x2160" },
  { width: 2560, height: 1600, label: "2560x1600" },
  { width: 3840, height: 1600, label: "3840x1600" },
];

const Settings = ({ onClose }) => {
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [volume, setVolume] = useState(100);
  const [displayMode, setDisplayMode] = useState('fullscreen');
  const [selectedResolution, setSelectedResolution] = useState({ width: 1920, height: 1080 });
  const [availableResolutions, setAvailableResolutions] = useState(resolutionOptions);

  // Load settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      if (window.electron && window.electron.settings) {
        try {
          const settings = await window.electron.settings.get();
          setBrightness(settings.brightness || 100);
          setContrast(settings.contrast || 100);
          setVolume(settings.volume || 100);
          setDisplayMode(settings.displayMode || 'fullscreen');
          setSelectedResolution({
            width: settings.windowWidth || 1920,
            height: settings.windowHeight || 1080
          });

          // Get screen info to filter available resolutions
          const screenInfo = await window.electron.settings.getScreenInfo();
          const maxWidth = screenInfo.primaryDisplay.bounds.width;
          const maxHeight = screenInfo.primaryDisplay.bounds.height;
          
          // Filter resolutions that fit the screen
          const filteredResolutions = resolutionOptions.filter(res => 
            res.width <= maxWidth && res.height <= maxHeight
          );
          setAvailableResolutions(filteredResolutions);
          
        } catch (error) {
          console.error('Error loading settings:', error);
        }
      }
    };
    
    loadSettings();
  }, []);

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

  const handleDisplayModeChange = async (newMode) => {
    setDisplayMode(newMode);
    
    if (window.electron && window.electron.settings) {
      try {
        if (newMode === 'windowed') {
          await window.electron.settings.setDisplayMode(
            newMode, 
            selectedResolution.width, 
            selectedResolution.height
          );
        } else {
          await window.electron.settings.setDisplayMode(newMode);
        }
      } catch (error) {
        console.error('Error setting display mode:', error);
      }
    }
  };

  const handleResolutionChange = async (resolution) => {
    setSelectedResolution(resolution);
    
    if (displayMode === 'windowed' && window.electron && window.electron.settings) {
      try {
        await window.electron.settings.setDisplayMode(
          'windowed', 
          resolution.width, 
          resolution.height
        );
      } catch (error) {
        console.error('Error setting resolution:', error);
      }
    }
  };

  const handleSaveSettings = async () => {
    if (window.electron && window.electron.settings) {
      try {
        await window.electron.settings.save({
          brightness,
          contrast,
          volume,
          displayMode,
          windowWidth: selectedResolution.width,
          windowHeight: selectedResolution.height
        });
      } catch (error) {
        console.error('Error saving settings:', error);
      }
    }
  };

  const handleReset = async () => {
    setBrightness(100);
    setContrast(100);
    setVolume(100);
    setDisplayMode('fullscreen');
    setSelectedResolution({ width: 1920, height: 1080 });
    
    if (window.electron && window.electron.settings) {
      try {
        await window.electron.settings.setDisplayMode('fullscreen');
        await window.electron.settings.save({
          brightness: 100,
          contrast: 100,
          volume: 100,
          displayMode: 'fullscreen',
          windowWidth: 1920,
          windowHeight: 1080
        });
      } catch (error) {
        console.error('Error resetting settings:', error);
      }
    }
  };

  return (
    <SettingsContainer className="settings-container">
      <Title>Game Settings</Title>
      
      <ControlGroup>
        <Label>Display Mode</Label>
        <Select
          value={displayMode}
          onChange={(e) => handleDisplayModeChange(e.target.value)}
        >
          <option value="fullscreen">Fullscreen</option>
          <option value="maximized">Maximized Window</option>
          <option value="windowed">Windowed</option>
        </Select>
      </ControlGroup>

      {displayMode === 'windowed' && (
        <ControlGroup>
          <Label>Resolution</Label>
          <ResolutionGrid>
            {availableResolutions.map((resolution) => (
              <ResolutionButton
                key={`${resolution.width}x${resolution.height}`}
                selected={selectedResolution.width === resolution.width && 
                         selectedResolution.height === resolution.height}
                onClick={() => handleResolutionChange(resolution)}
              >
                {resolution.label}
              </ResolutionButton>
            ))}
          </ResolutionGrid>
        </ControlGroup>
      )}

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

      <Button onClick={handleSaveSettings}>Save Settings</Button>
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
