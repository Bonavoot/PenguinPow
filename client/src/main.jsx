import React from "react";
import ReactDOM from "react-dom/client";

import "@fontsource/bungee";
import "@fontsource/space-grotesk/300.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
// CJK fonts are huge (~120 subset files per weight) — only import the weights
// actually used in the UI: serif 400/700/900, sans 600.
import "@fontsource/noto-serif-jp/400.css";
import "@fontsource/noto-serif-jp/700.css";
import "@fontsource/noto-serif-jp/900.css";
import "@fontsource/noto-sans-jp/600.css";
import "./assets/fonts/material-symbols.css";

import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <App />
);
