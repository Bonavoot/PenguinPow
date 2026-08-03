import { useState, useEffect, useContext, useCallback, useRef } from "react";
import { SocketContext } from "../SocketContext";
import PropTypes from "prop-types";
import {
  getServerOffset,
  isServerClockSynced,
  getEstimatedRtt,
} from "../lib/serverClock";
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

  // Mirror of the last-emitted key state. Used to compute per-key edge
  // events for the events array on each emit (server reads them to detect
  // press-release-press transitions faster than the React state cadence).
  const lastEmittedKeysRef = useRef({ ...initialKeyState });

  // Function to emit key state changes
  const emitKeyState = useCallback(
    (newKeyState) => {
      // Block inputs during power-up selection or when throwing snowball
      if (isInputBlocked || currentPlayer?.isThrowingSnowball) return;

      // When being grabbed, allow full clinch kit (push/plant/throw/jolt/break).
      // Block open-game actions (dash / power-ups). ARM CLAMP is server-side.
      if (currentPlayer?.isBeingGrabbed) {
        const clinchOnly = {
          w: newKeyState.w || false,
          a: newKeyState.a || false,
          s: newKeyState.s || false,
          d: newKeyState.d || false,
          " ": newKeyState[" "] || false,
          shift: false,
          e: false,
          f: false,
          mouse1: newKeyState.mouse1 || false,
          mouse2: newKeyState.mouse2 || false,
        };
        // Constrained packet — no events array (grab-counter inputs are
        // slow holds and the server doesn't replay events in this branch).
        const clientSynced = isServerClockSynced();
        socket.emit("fighter_action", {
          id: socket.id,
          keys: clinchOnly,
          clientSynced,
          clientOffset: clientSynced ? getServerOffset() : 0,
          clientRtt: clientSynced ? getEstimatedRtt() : 0,
        });
        return;
      }

      // Diff against last-emitted state to produce per-key edge events.
      const events = [];
      const prev = lastEmittedKeysRef.current;
      for (const k in newKeyState) {
        if (!Object.prototype.hasOwnProperty.call(newKeyState, k)) continue;
        const prevDown = !!prev[k];
        const nextDown = !!newKeyState[k];
        if (prevDown !== nextDown) {
          events.push({ k, a: nextDown ? "down" : "up", t: performance.now() });
        }
      }
      lastEmittedKeysRef.current = { ...newKeyState };
      const clientSynced = isServerClockSynced();
      socket.emit("fighter_action", {
        id: socket.id,
        keys: newKeyState,
        events,
        clientSynced,
        clientOffset: clientSynced ? getServerOffset() : 0,
        clientRtt: clientSynced ? getEstimatedRtt() : 0,
      });
    },
    [socket, isInputBlocked, currentPlayer?.isThrowingSnowball, currentPlayer?.isBeingGrabbed]
  );

  // Handle joystick touch start
  const handleJoystickStart = (e) => {
    // Block inputs during power-up selection or when throwing snowball
    if (isInputBlocked || currentPlayer?.isThrowingSnowball) return;

    // Joystick stays live while grabbed — drives clinch push/plant (A/D/S).
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

    // While grabbed: allow break (attack/Space), throw (W), grab/M2 (throw chord).
    // Block dash — open-game only.
    if (currentPlayer?.isBeingGrabbed && action === "dash") return;

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
        case "dash":
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

    if (currentPlayer?.isBeingGrabbed && action === "dash") return;

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
        case "dash":
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
          className="action-button dash-button"
          onTouchStart={(e) => handleButtonPress(e, "dash")}
          onTouchEnd={(e) => handleButtonRelease(e, "dash")}
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
