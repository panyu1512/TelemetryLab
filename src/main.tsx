import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { OverlayWindow } from "./components/OverlayWindow";
import { getOverlayRoute } from "./lib/overlayWindows";
import "./styles.css";

// `?overlay=<id>` renders that single overlay in isolation (a spawned desktop
// window or a browser-source tab); otherwise the full app with its dock.
const overlayId = getOverlayRoute();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {overlayId ? <OverlayWindow id={overlayId} /> : <App />}
  </React.StrictMode>
);
