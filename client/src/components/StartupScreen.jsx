import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import gamepadHandler from "../utils/gamepadHandler";

const StartupScreen = ({ onContinue, connectionError, steamDeckMode }) => {
  const [showPressKey, setShowPressKey] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [dots, setDots] = useState("");

  useEffect(() => {
    // Simulate initial loading/connecting phase
    const connectingTimer = setTimeout(() => {
      setIsConnecting(false);
      setShowPressKey(true);
    }, 2000);

    // Animate dots for connecting message
    const dotsInterval = setInterval(() => {
      setDots((prev) => {
        if (prev === "...") return "";
        return prev + ".";
      });
    }, 500);

    return () => {
      clearTimeout(connectingTimer);
      clearInterval(dotsInterval);
    };
  }, []);

  useEffect(() => {
    if (!showPressKey) return;

    const handleKeyPress = () => {
      // Any key press continues
      onContinue();
    };

    const handleMouseClick = (event) => {
      // Left click (button 0) or right click (button 2)
      if (event.button === 0 || event.button === 2) {
        onContinue();
      }
    };

    const handleGamepadInput = () => {
      // Check for any gamepad button press
      if (gamepadHandler.isConnected()) {
        const gamepad = gamepadHandler.getGamepad();
        if (gamepad) {
          // Check if any button is pressed
          const anyButtonPressed = gamepad.buttons.some(
            (button) => button.pressed
          );
          if (anyButtonPressed) {
            onContinue();
          }
        }
      }
    };

    // Set up keyboard listener
    document.addEventListener("keydown", handleKeyPress);

    // Set up mouse listeners
    document.addEventListener("mousedown", handleMouseClick);
    document.addEventListener("contextmenu", (e) => e.preventDefault()); // Prevent right-click menu

    // Set up gamepad polling
    const gamepadInterval = setInterval(handleGamepadInput, 100);

    return () => {
      document.removeEventListener("keydown", handleKeyPress);
      document.removeEventListener("mousedown", handleMouseClick);
      document.removeEventListener("contextmenu", (e) => e.preventDefault());
      clearInterval(gamepadInterval);
    };
  }, [showPressKey, onContinue]);

  return (
    <div className="startup-screen">
      <div className="startup-content">
        {/* Game Title */}
        <div className="startup-title">
          <h1 className="startup-logo">
            P u m o <span className="startup-pow">PUMO !</span>
          </h1>
        </div>

        {/* Loading/Connection Status */}
        <div className="startup-status">
          {isConnecting && !connectionError && (
            <div className="connecting-message">
              <p>Connecting to server{dots}</p>
            </div>
          )}

          {connectionError && (
            <div className="connection-error">
              <p>⚠️ Connection failed - Playing offline</p>
            </div>
          )}

          {showPressKey && (
            <div className="press-key-message">
              <p className="press-key-text">
                {steamDeckMode
                  ? "Press any button to continue"
                  : "Press any key to continue"}
              </p>
            </div>
          )}
        </div>

        {/* Optional: Version or additional info */}
        <div className="startup-footer">
          <p className="version-text">v1.0.0</p>
        </div>
      </div>
    </div>
  );
};

StartupScreen.propTypes = {
  onContinue: PropTypes.func.isRequired,
  connectionError: PropTypes.bool,
  steamDeckMode: PropTypes.bool,
};

export default StartupScreen;
