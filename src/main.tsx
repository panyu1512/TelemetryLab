import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { OverlayWindow } from "./components/OverlayWindow";
import { SingleWidgetWindow } from "./components/SingleWidgetWindow";
import { getOverlayRoute, getWidgetRoute } from "./lib/overlayWindows";
import "@fontsource-variable/inter";
import "flag-icons/css/flag-icons.min.css";
import "./styles.css";

// `?widget=<id>` renders a single telemetry widget; `?overlay=<id>` renders one
// whole overlay; otherwise the full app with its dock. The first two are
// spawned desktop windows or browser-source tabs.
const widgetId = getWidgetRoute();
const overlayId = getOverlayRoute();

// A single-view window paints transparent so the game shows through. Set the
// background to transparent *synchronously* (before first paint) so there's no
// black flash before the theme effect runs.
if (widgetId || overlayId) {
  const root = document.documentElement;
  root.classList.add("overlay-mode");
  root.style.setProperty("--color-bg", "transparent");
  root.style.setProperty("--bg", "transparent");
}

let view: React.ReactNode;
if (widgetId) view = <SingleWidgetWindow id={widgetId} />;
else if (overlayId) view = <OverlayWindow id={overlayId} />;
else view = <App />;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{view}</React.StrictMode>
);
