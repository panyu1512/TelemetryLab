# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-07-02

Session & multi-car data layer: the bridge now understands the whole field and
the session, not just the player, and publishes it over a redesigned
multi-channel protocol. This is the foundation for standings, relative, track
map and race-control screens.

### Added

- **Shared bridge core** (`bridge/telemetrylab/`): a source-agnostic package —
  wire protocol, normalized dataclasses, DriverInfo/CarIdx parsing,
  session/car repositories, an event bus, and a channel publisher — wired
  together by a `BridgeService`. The real (pyirsdk) and mock bridges are now
  thin *sources* over the same machine, guaranteeing identical payloads.
- **Multi-channel WebSocket protocol** with a versioned envelope
  (`{ v, type, ts, seq, payload }`):
  - `telemetry` (~60 Hz) — player car only.
  - `standings` (~5–10 Hz, on change) — computed field order, gaps, per-car
    timing, pit/track-surface state.
  - `session` (on change / ~1 Hz) — driver roster, session/track/weather
    metadata, flags, and Strength of Field.
  - `bridge` — connection status, replacing the old `{connected:false}`
    heartbeat.
  - Stateful channels are **replayed on connect** so late joiners render the
    current world immediately.
- **Driver roster** parsed from the `DriverInfo` session info: name, team, car
  number/brand/model, class, iRating, license + safety rating, club, division,
  and pace/spectator/AI/team flags. Per-class and overall SOF computed with the
  iRacing-style exponential model.
- **Session state**: time/laps remaining, session state + decoded flags,
  track/weather metadata, and self-calibration data (redline RPM, est lap time)
  that the widgets previously had to guess.
- **Per-car timing** from the `CarIdx*` arrays, plus a standings computation
  skeleton (field order, gap-to-leader / interval, lapped detection) and a
  relative `deltaToPlayer` computed from est-time.
- **Frontend data layer**: typed models mirroring the Python (`src/telemetry/`),
  a single multiplexing WebSocket connection (`useBridge`), and four Zustand
  stores. The standings store is normalized (`order` + `byIdx`) so 100+ rows
  only re-render when their own values change.
- **Mock bridge** now synthesizes a full multi-car field (`MOCK_CARS`,
  `MOCK_MULTICLASS`) so the multi-car screens can be developed without iRacing.

### Changed

- `useTelemetry()` is now a single-car compatibility selector over the stores
  (the socket moved to `useBridge`); the dashboard widgets are unchanged.

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
