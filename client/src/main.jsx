import React from "react";
import ReactDOM from "react-dom/client";

// Display face — bundled via fontsource (offline-safe for Electron/Steam)
import "@fontsource/bungee";

// Interface face — local Fontshare WOFF2 (see assets/fonts/chillax.css)
import "./assets/fonts/chillax.css";

// CJK ceremonial accents only (~subset per weight)
import "@fontsource/noto-serif-jp/400.css";
import "@fontsource/noto-serif-jp/700.css";
import "@fontsource/noto-serif-jp/900.css";
import "@fontsource/noto-sans-jp/600.css";

import "./assets/fonts/material-symbols.css";
import "./styles/typography.css";

import App from "./App.jsx";
import {
  ensurePerfRecorder,
  setupPerfShortcut,
} from "./utils/perf/PerfRecorder";

// Phase 0: opt-in performance recorder (?perf=1 or localStorage pumo_perf=1).
// No-op when disabled. Overlay toggle: Ctrl+Shift+P.
ensurePerfRecorder();
setupPerfShortcut();

// Warm faces in the background — do not block first paint
if (document.fonts?.load) {
  Promise.all([
    document.fonts.load('400 1em "Bungee"'),
    document.fonts.load('400 1em "Chillax"'),
    document.fonts.load('500 1em "Chillax"'),
    document.fonts.load('600 1em "Chillax"'),
    document.fonts.load('700 1em "Chillax"'),
  ]).catch(() => {});
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
