import { useState, useEffect, useContext, useCallback } from "react";
import { SocketContext } from "../SocketContext";
import PropTypes from "prop-types";
import "./MobileControls.css";

const MobileControls = ({ isInputBlocked = false, currentPlayer }) => {
  const { socket } = useContext(SocketContext);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [isTouchingJoystick, setIsTouchingJoystick] = useState(false);
  const [joystickId, setJoystickId] = useState(null);

  // Initialize key state object
  const initialKeyState = {
    w: false,
    a: false,
    s: false,
    d: false,
    " ": false,
    shift: false,
    e: false,
    f: false,
    mouse1: false,
    mouse2: false,
  };

  const [keyState, setKeyState] = useState(initialKeyState);

  // Function to emit key state changes
  const emitKeyState = useCallback(
    (newKeyState) => {
      // Block inputs during power-up selection or when throwing snowball
      if (isInputBlocked || currentPlayer?.isThrowingSnowball) return;

      // Block all inputs except spacebar when being grabbed
      if (currentPlayer?.isBeingGrabbed) {
        // Only allow spacebar (grab break)
        const grabBreakOnly = {
          w: false,
          a: false,
          s: false,
          d: false,
          " ": newKeyState[" "] || false,
          shift: false,
          e: false,
          f: false,
        };
        socket.emit("fighter_action", { id: socket.id, keys: grabBreakOnly });
        return;
      }

      socket.emit("fighter_action", { id: socket.id, keys: newKeyState });
    },
    [socket, isInputBlocked, currentPlayer?.isThrowingSnowball, currentPlayer?.isBeingGrabbed]
  );

  // Handle joystick touch start
  const handleJoystickStart = (e) => {
    // Block inputs during power-up selection or when throwing snowball
    if (isInputBlocked || currentPlayer?.isThrowingSnowball) return;

    // Block joystick inputs when being grabbed
    if (currentPlayer?.isBeingGrabbed) return;

    e.preventDefault();
    const touch = e.touches[0];
    const joystick = e.target.getBoundingClientRect();
    const centerX = joystick.left + joystick.width / 2;
    const centerY = joystick.top + joystick.height / 2;

    setJoystickId(touch.identifier);
    setIsTouchingJoystick(true);
    updateJoystickPosition(touch.clientX - centerX, touch.clientY - centerY);
  };

  // Handle joystick movement
  const handleJoystickMove = (e) => {
    // Block inputs during power-up selection or when throwing snowball
    if (isInputBlocked || currentPlayer?.isThrowingSnowball) return;

    // Block joystick inputs when being grabbed
    if (currentPlayer?.isBeingGrabbed) return;

    e.preventDefault();
    if (!isTouchingJoystick) return;

    const touch = Array.from(e.touches).find(
      (t) => t.identifier === joystickId
    );
    if (!touch) return;

    const joystick = e.target.getBoundingClientRect();
    const centerX = joystick.left + joystick.width / 2;
    const centerY = joystick.top + joystick.height / 2;

    updateJoystickPosition(touch.clientX - centerX, touch.clientY - centerY);
  };

  // Handle joystick release
  const handleJoystickEnd = (e) => {
    // Block inputs during power-up selection or when throwing snowball
    if (isInputBlocked || currentPlayer?.isThrowingSnowball) return;

    // Block joystick inputs when being grabbed
    if (currentPlayer?.isBeingGrabbed) return;

    e.preventDefault();
    setIsTouchingJoystick(false);
    setJoystickPos({ x: 0, y: 0 });
    setJoystickId(null);

    // Reset movement keys
    setKeyState((prev) => {
      const newState = { ...prev, a: false, d: false, " ": false };
      emitKeyState(newState);
      return newState;
    });
  };

  // Update joystick position and emit movement
  const updateJoystickPosition = (x, y) => {
    const maxDistance = 50;
    const distance = Math.sqrt(x * x + y * y);
    const angle = Math.atan2(y, x);

    // Normalize distance
    const normalizedDistance = Math.min(distance, maxDistance);
    const normalizedX = Math.cos(angle) * normalizedDistance;
    const normalizedY = Math.sin(angle) * normalizedDistance;

    setJoystickPos({ x: normalizedX, y: normalizedY });

    // Update movement keys based on joystick position
    setKeyState((prev) => {
      const newState = {
        ...prev,
        a: normalizedX < -20,
        d: normalizedX > 20,
        " ": normalizedY > 20, // Raw parry when joystick is pulled down
      };
      emitKeyState(newState);
      return newState;
    });
  };

  // Handle action button press
  const handleButtonPress = (e, action) => {
    // Block inputs during power-up selection or when throwing snowball
    if (isInputBlocked || currentPlayer?.isThrowingSnowball) return;

    // Block all action buttons except attack (spacebar/grab break) when being grabbed
    if (currentPlayer?.isBeingGrabbed && action !== "attack") return;

    e.preventDefault();
    setKeyState((prev) => {
      const newState = { ...prev };
      switch (action) {
        case "attack":
          newState[" "] = true;
          break;
        case "throw":
          newState.w = true;
          break;
        case "grab":
          newState.mouse2 = true;
          break;
        case "dodge":
          newState.shift = true;
          break;
      }
      emitKeyState(newState);
      return newState;
    });
  };

  // Handle action button release
  const handleButtonRelease = (e, action) => {
    // Block inputs during power-up selection or when throwing snowball
    if (isInputBlocked || currentPlayer?.isThrowingSnowball) return;

    // Block all action buttons except attack (spacebar/grab break) when being grabbed
    if (currentPlayer?.isBeingGrabbed && action !== "attack") return;

    e.preventDefault();
    setKeyState((prev) => {
      const newState = { ...prev };
      switch (action) {
        case "attack":
          newState[" "] = false;
          break;
        case "throw":
          newState.w = false;
          break;
        case "grab":
          newState.mouse2 = false;
          break;
        case "dodge":
          newState.shift = false;
          break;
      }
      emitKeyState(newState);
      return newState;
    });
  };

  // Only show controls on actual touch-only devices (not desktop/laptop with trackpad)
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    const hasTouchScreen = navigator.maxTouchPoints > 1;
    const hasNoMouse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    setIsTouchDevice(hasTouchScreen && hasNoMouse);
  }, []);

  // Prevent default touch behavior to avoid scrolling
  useEffect(() => {
    const preventDefault = (e) => e.preventDefault();
    document.addEventListener("touchmove", preventDefault, { passive: false });
    return () => {
      document.removeEventListener("touchmove", preventDefault);
    };
  }, []);

  if (!isTouchDevice) return null;

  return (
    <div className="mobile-controls">
      {/* Left side - Joystick */}
      <div className="joystick-area">
        <div
          className="joystick-base"
          onTouchStart={handleJoystickStart}
          onTouchMove={handleJoystickMove}
          onTouchEnd={handleJoystickEnd}
          onTouchCancel={handleJoystickEnd}
        >
          <div
            className="joystick-stick"
            style={{
              transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
              transition: isTouchingJoystick ? "none" : "all 0.2s",
            }}
          />
        </div>
      </div>

      {/* Right side - Action Buttons */}
      <div className="action-buttons">
        <button
          className="action-button attack-button"
          onTouchStart={(e) => handleButtonPress(e, "attack")}
          onTouchEnd={(e) => handleButtonRelease(e, "attack")}
        >
          A
        </button>
        <button
          className="action-button throw-button"
          onTouchStart={(e) => handleButtonPress(e, "throw")}
          onTouchEnd={(e) => handleButtonRelease(e, "throw")}
        >
          T
        </button>
        <button
          className="action-button grab-button"
          onTouchStart={(e) => handleButtonPress(e, "grab")}
          onTouchEnd={(e) => handleButtonRelease(e, "grab")}
        >
          G
        </button>
        <button
          className="action-button dodge-button"
          onTouchStart={(e) => handleButtonPress(e, "dodge")}
          onTouchEnd={(e) => handleButtonRelease(e, "dodge")}
        >
          D
        </button>
      </div>
    </div>
  );
};

MobileControls.propTypes = {
  isInputBlocked: PropTypes.bool,
  currentPlayer: PropTypes.object,
};

export default MobileControls;
