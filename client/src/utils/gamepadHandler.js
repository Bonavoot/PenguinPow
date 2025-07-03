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
    this.debugMode = false;
    this.lastButtonStates = [];

    this.init();
  }

  init() {
    // Listen for gamepad connection events
    window.addEventListener("gamepadconnected", (e) => {
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

  logGamepadInfo(gamepad) {
    if (this.debugMode) {
      console.log("🎮 GAMEPAD DEBUG INFO:");
      console.log(`ID: ${gamepad.id}`);
      console.log(`Mapping: ${gamepad.mapping}`);
      console.log(`Buttons: ${gamepad.buttons.length}`);
      console.log(`Axes: ${gamepad.axes.length}`);
      console.log(`Timestamp: ${gamepad.timestamp}`);

      // Log all button states
      gamepad.buttons.forEach((button, index) => {
        if (button.pressed) {
          console.log(`🎮 Button ${index} pressed: ${button.value}`);
        }
      });
    }
  }

  initializeSteamInput() {
    // Force disable Steam Input to prevent interference
    if (
      typeof window.SteamInput !== "undefined" &&
      !this.steamInputInitialized
    ) {
      try {
        // Try to disable Steam Input remapping
        if (window.SteamInput.Shutdown) {
          window.SteamInput.Shutdown();
        }
        this.steamInputInitialized = true;
      } catch (error) {
        // Ignore errors - we want to bypass Steam Input anyway
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
    newKeyState[" "] = leftStickY > this.deadzone; // Raw parry (down)

    // UNIVERSAL BUTTON MAPPING - Works on both PC and Steam Deck
    // Try all common button combinations to ensure compatibility
    newKeyState[" "] = this.getButtonPressed(gamepad, [0, 1, 7]) || false; // Attack - A button (multiple indices)
    newKeyState.shift = this.getButtonPressed(gamepad, [1, 0, 6]) || false; // Dodge - B button
    newKeyState.e = this.getButtonPressed(gamepad, [2, 3, 5]) || false; // Grab - X button
    newKeyState.w = this.getButtonPressed(gamepad, [3, 2, 4]) || false; // Throw - Y button

    // Shoulder buttons - try multiple combinations
    newKeyState.mouse1 = this.getButtonPressed(gamepad, [4, 6, 8, 10]) || false; // L1/L2
    newKeyState.mouse2 = this.getButtonPressed(gamepad, [5, 7, 9, 11]) || false; // R1/R2

    // D-pad for precise movement (works the same on both)
    if (gamepad.buttons[12]?.pressed) newKeyState[" "] = true; // D-pad up -> raw parry
    if (gamepad.buttons[13]?.pressed) newKeyState[" "] = true; // D-pad down -> raw parry
    if (gamepad.buttons[14]?.pressed) newKeyState.a = true; // D-pad left
    if (gamepad.buttons[15]?.pressed) newKeyState.d = true; // D-pad right

    // Check if input state changed
    if (this.hasInputChanged(newKeyState)) {
      this.keyState = newKeyState;
      this.notifyInputChange(newKeyState);
      this.lastInputTime = Date.now();

      // Steam Deck haptic feedback
      this.triggerHapticFeedback(gamepad, newKeyState);
    }
  }

  // Helper method to try multiple button indices (for Steam Deck compatibility)
  getButtonPressed(gamepad, buttonIndices) {
    for (const index of buttonIndices) {
      if (gamepad.buttons[index]?.pressed) {
        return true;
      }
    }
    return false;
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
    const isSteamDeckUA =
      userAgent.includes("steamdeck") || userAgent.includes("steamos");
    const isSteamInput = typeof window.SteamInput !== "undefined";
    const isSteamDeckResolution =
      window.screen.width === 1280 && window.screen.height === 800;

    console.log(`🎮 Steam Deck Detection:`, {
      userAgent: isSteamDeckUA,
      steamInput: isSteamInput,
      resolution: isSteamDeckResolution,
      final: isSteamDeckUA || isSteamInput || isSteamDeckResolution,
    });

    return isSteamDeckUA || isSteamInput || isSteamDeckResolution;
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

  // Debug method to help troubleshoot Steam Deck controls
  enableDebugMode() {
    this.debugMode = true;
    console.log(
      "🎮 Gamepad debug mode enabled - check console for button press logs"
    );
  }

  disableDebugMode() {
    this.debugMode = false;
    console.log("🎮 Gamepad debug mode disabled");
  }
}

// Create singleton instance
const gamepadHandler = new GamepadHandler();

export default gamepadHandler;
