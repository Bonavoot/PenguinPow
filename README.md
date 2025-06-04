# PenguinPow Game

A Steam game built with React, Socket.io, and Electron.

## Display Settings

The game now launches in **fullscreen mode by default** when started through Steam. Players can customize their display experience through the in-game settings menu.

### Available Display Modes

1. **Fullscreen** (Default) - Full immersive gaming experience
2. **Maximized Window** - Windowed but maximized to screen size
3. **Windowed** - Traditional windowed mode with custom resolution options

### Resolution Options (Windowed Mode)

When using windowed mode, players can choose from these resolution options (filtered based on screen capability):

- 1920x1080 (Full HD)
- 2560x1440 (QHD)
- 3440x1440 (Ultrawide QHD)
- 3840x2160 (4K UHD)
- 2560x1600 (WQXGA)
- 3840x1600 (Ultrawide 4K)

### Settings Persistence

All display settings are automatically saved and restored when the game is restarted. Settings are stored in the user's application data directory.

### Accessing Display Settings

1. Launch the game
2. Navigate to Settings from the main menu
3. Adjust Display Mode and Resolution as desired
4. Click "Save Settings" to persist changes
5. Changes take effect immediately

## Development

### Installation
```bash
npm run install:all
```

### Running in Development
```bash
npm run dev:game
```

### Building for Production
```bash
npm run build:client
npm run build:electron
``` 