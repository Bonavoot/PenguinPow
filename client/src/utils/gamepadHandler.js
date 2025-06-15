/**
 * Steam Deck Gamepad Input Handler
 * Handles controller input mapping and Steam Input API integration
 */

class GamepadHandler {
  constructor() {
    this.gamepadIndex = -1;
    this.gamepadConnected = false;
    this.keyState = {
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
    this.deadzone = 0.2;
    this.lastInputTime = 0;
    this.inputCallbacks = [];
    this.steamInputInitialized = false;

    this.init();
  }

  init() {
    // Listen for gamepad connection events
    window.addEventListener("gamepadconnected", (e) => {
      console.log(`🎮 Steam Deck Controller connected: ${e.gamepad.id}`);
      this.gamepadIndex = e.gamepad.index;
      this.gamepadConnected = true;
      this.initializeSteamInput();
    });

    window.addEventListener("gamepaddisconnected", (e) => {
      console.log(`🎮 Controller disconnected: ${e.gamepad.id}`);
      if (e.gamepad.index === this.gamepadIndex) {
        this.gamepadIndex = -1;
        this.gamepadConnected = false;
      }
    });

    // Start polling for input
    this.pollGamepad();
  }

  initializeSteamInput() {
    // Check if we're running on Steam Deck or with Steam Input API
    if (
      typeof window.SteamInput !== "undefined" &&
      !this.steamInputInitialized
    ) {
      try {
        window.SteamInput.Init();
        this.steamInputInitialized = true;
        console.log("🎮 Steam Input API initialized");
      } catch (error) {
        console.warn("Steam Input API not available:", error);
      }
    }
  }

  pollGamepad() {
    if (this.gamepadConnected && this.gamepadIndex >= 0) {
      const gamepad = navigator.getGamepads()[this.gamepadIndex];
      if (gamepad) {
        this.processInput(gamepad);
      }
    }
    requestAnimationFrame(() => this.pollGamepad());
  }

  processInput(gamepad) {
    const newKeyState = { ...this.keyState };

    // Steam Deck Analog Sticks
    // Left stick for movement (WASD)
    const leftStickX = gamepad.axes[0];
    const leftStickY = gamepad.axes[1];

    newKeyState.a = leftStickX < -this.deadzone; // Move left
    newKeyState.d = leftStickX > this.deadzone; // Move right
    newKeyState.s = leftStickY > this.deadzone; // Crouch (down)

    // Right stick for additional movement or camera (if needed)
    // const rightStickX = gamepad.axes[2];
    // const rightStickY = gamepad.axes[3];

    // Steam Deck Button Mapping (optimized for handheld)
    // Face buttons (A, B, X, Y)
    newKeyState[" "] = gamepad.buttons[0]?.pressed || false; // A button - Attack
    newKeyState.shift = gamepad.buttons[1]?.pressed || false; // B button - Dodge
    newKeyState.e = gamepad.buttons[2]?.pressed || false; // X button - Grab
    newKeyState.w = gamepad.buttons[3]?.pressed || false; // Y button - Throw

    // Shoulder buttons
    newKeyState.mouse1 = gamepad.buttons[4]?.pressed || false; // L1 - Left mouse
    newKeyState.mouse2 = gamepad.buttons[5]?.pressed || false; // R1 - Right mouse

    // Triggers for additional actions (unused for now but available for future features)
    // const leftTrigger = gamepad.buttons[6]?.value || 0;
    // const rightTrigger = gamepad.buttons[7]?.value || 0;

    // D-pad for precise movement (alternative to analog stick)
    if (gamepad.buttons[12]?.pressed) newKeyState.s = true; // D-pad up -> crouch
    if (gamepad.buttons[13]?.pressed) newKeyState.s = true; // D-pad down -> crouch
    if (gamepad.buttons[14]?.pressed) newKeyState.a = true; // D-pad left
    if (gamepad.buttons[15]?.pressed) newKeyState.d = true; // D-pad right

    // Steam Deck specific buttons
    // Back/Select button (button 8) - could be used for menu
    // Start button (button 9) - could be used for pause

    // Check if input state changed
    if (this.hasInputChanged(newKeyState)) {
      this.keyState = newKeyState;
      this.notifyInputChange(newKeyState);
      this.lastInputTime = Date.now();

      // Steam Deck haptic feedback
      this.triggerHapticFeedback(gamepad, newKeyState);
    }
  }

  triggerHapticFeedback(gamepad, keyState) {
    // Steam Deck has advanced haptics - provide feedback for actions
    if (typeof gamepad.vibrationActuator !== "undefined") {
      let intensity = 0;
      let duration = 0;

      // Attack feedback
      if (keyState[" "]) {
        intensity = 0.3;
        duration = 100;
      }
      // Grab feedback
      else if (keyState.e) {
        intensity = 0.2;
        duration = 150;
      }
      // Throw feedback
      else if (keyState.w) {
        intensity = 0.4;
        duration = 200;
      }
      // Dodge feedback
      else if (keyState.shift) {
        intensity = 0.1;
        duration = 80;
      }

      if (intensity > 0) {
        gamepad.vibrationActuator
          .playEffect("dual-rumble", {
            duration: duration,
            strongMagnitude: intensity,
            weakMagnitude: intensity * 0.5,
          })
          .catch(() => {
            // Fallback for older vibration API
            if (typeof gamepad.vibrate === "function") {
              gamepad.vibrate([intensity * 1000, 50]);
            }
          });
      }
    }
  }

  hasInputChanged(newKeyState) {
    return Object.keys(newKeyState).some(
      (key) => this.keyState[key] !== newKeyState[key]
    );
  }

  addInputCallback(callback) {
    this.inputCallbacks.push(callback);
  }

  removeInputCallback(callback) {
    this.inputCallbacks = this.inputCallbacks.filter((cb) => cb !== callback);
  }

  notifyInputChange(keyState) {
    this.inputCallbacks.forEach((callback) => {
      try {
        callback(keyState);
      } catch (error) {
        console.error("Error in input callback:", error);
      }
    });
  }

  // Steam Deck specific methods
  isSteamDeck() {
    // Detect if running on Steam Deck
    const userAgent = navigator.userAgent.toLowerCase();
    return (
      userAgent.includes("steamdeck") ||
      userAgent.includes("steamos") ||
      typeof window.SteamInput !== "undefined"
    );
  }

  getRecommendedSettings() {
    if (this.isSteamDeck()) {
      return {
        enableHaptics: true,
        preferAnalogMovement: true,
        uiScale: 1.2, // Larger UI for handheld
        targetFPS: 60, // Steam Deck optimization
        preferredResolution: "1280x800", // Steam Deck native resolution
      };
    }
    return {
      enableHaptics: false,
      preferAnalogMovement: false,
      uiScale: 1.0,
      targetFPS: 120,
      preferredResolution: "1920x1080",
    };
  }

  getCurrentKeyState() {
    return { ...this.keyState };
  }

  isConnected() {
    return this.gamepadConnected;
  }

  getControllerInfo() {
    if (this.gamepadConnected && this.gamepadIndex >= 0) {
      const gamepad = navigator.getGamepads()[this.gamepadIndex];
      return {
        id: gamepad?.id || "Unknown",
        index: this.gamepadIndex,
        timestamp: gamepad?.timestamp || 0,
        connected: gamepad?.connected || false,
        buttons: gamepad?.buttons?.length || 0,
        axes: gamepad?.axes?.length || 0,
      };
    }
    return null;
  }
}

// Create singleton instance
const gamepadHandler = new GamepadHandler();

export default gamepadHandler;
