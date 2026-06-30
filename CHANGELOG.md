# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- Session & multi-car data layer: teach the bridge to publish the whole field
  and the session (not just the player), split into WebSocket channels. See the
  [roadmap](ROADMAP.md).

## [0.2.0] - 2026-06-30

Real dashboard widgets: the raw telemetry view becomes an actual driving
dashboard, all from the existing single-car `TelemetryData`.

### Added

- **Dashboard widgets** replacing the raw JSON view:
  - **Cluster** — radial speed gauge, gear, and an RPM bar with progressive
    shift lights (redline self-calibrated from the observed peak RPM).
  - **Inputs** — a rolling throttle/brake trace graph, vertical throttle/brake
    bars, and a steering-deflection indicator.
  - **Fuel** — tank level, percentage, and a "laps of fuel left" estimate
    (per-lap burn sampled at lap boundaries).
  - **Lap timing** — current / last / best with a colored delta vs best.
  - **Tyre temps** — per-corner temperatures on a color heat scale, with
    pressures.
  - **Position** — race position and current lap.
- **Reusable widget primitives** (`Gauge`, `Bar`, `StatTile`) plus telemetry
  helpers (`useFuelEstimate`, `useInputTrace`, `usePeak`, color/delta scales).
- **Configurable dashboard layout** — a drag-and-drop / resize grid
  (`react-grid-layout`) with a floating overlay dock to switch dashboards, an
  overlay manager to toggle widgets, and an edit mode; the layout persists to
  `localStorage`.
- **Responsive widgets** — content scales fluidly with widget size via CSS
  container queries.
- **Tailwind CSS v4** (mapped to the existing design tokens) and `lucide-react`
  icons.

## [0.1.0] - 2026-06-28

Initial project scaffold: a working pipeline from iRacing shared memory to a
React dashboard, plus CI that ships a Windows installer.

### Added

- **Tauri v2 desktop shell** (`src-tauri/`) with a frameless 1400×900 dark
  window (`#0a0a0a`), spawning and supervising the Python sidecar and killing it
  on exit. stdout/stderr of the bridge is logged for debugging.
- **Python telemetry bridge** (`bridge/bridge.py`) reading iRacing shared memory
  via `pyirsdk` at ~60 fps and broadcasting JSON over `ws://localhost:8765`.
  Reads speed, RPM, gear, throttle/brake, steering, fuel, lap timing, position,
  lat/lon accel, pit road, session/air/track temps and per-tyre carcass
  temperatures + pressures. Converts `Speed`→`SpeedKmh` and
  `SteeringWheelAngle`→`SteeringDeg`. Emits `{"connected": false}` once per
  second when iRacing is closed and reconnects automatically.
- **Mock bridge** (`bridge/mock_bridge.py`) producing synthetic, realistic
  telemetry with the same protocol for development on macOS/Linux (no `pyirsdk`).
- **React + Vite + TypeScript frontend** with a fully typed `useTelemetry` hook
  (WebSocket with exponential-backoff reconnect, 1s→10s) and a placeholder dark
  dashboard showing connection states and the raw telemetry frame.
- **Configurable bridge endpoint** via `VITE_WS_HOST` / `VITE_WS_PORT`
  (no hardcoded `localhost`).
- **PyInstaller onefile build** (`bridge/bridge.spec`, `console=True`) with the
  required `websockets` / `irsdk` hidden imports.
- **GitHub Actions CI** (`.github/workflows/build.yml`) on `windows-latest`:
  builds the sidecar, stages it as
  `iracing-bridge-x86_64-pc-windows-msvc.exe`, runs `tauri build`, and publishes
  the `.msi` as an artifact and a Release asset on `v*` tags.
- Project documentation (`README.md`) with Windows and macOS (mock) setup.

[Unreleased]: https://github.com/panyu1512/TelemetryLab/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/panyu1512/TelemetryLab/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/panyu1512/TelemetryLab/releases/tag/v0.1.0
