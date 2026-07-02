# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2026-07-02

Relative screen: the classic proximity overlay showing the handful of cars
physically around the player on track, sorted by signed time gap, with
closing-rate hints for multi-class traffic.

### Added

- **`RelativeScreen`** (`src/components/relative/RelativeScreen.tsx`): a
  full-bleed screen registered at the "Relative" dashboard slot, now active
  (was previously a "coming soon" placeholder).
  - **Window size control** (±, default 5, range 3–10): shows N cars ahead and N
    cars behind the player. Adjusted via `+` / `-` buttons in the header.
  - **Signed relative gap** column: `+X.Xs` (green) for cars ahead, `-X.Xs`
    (red) for cars behind, `0.0s` for the player row. Values come from
    `StandingsEntry.intervalToPlayer`, which the bridge already computes each
    tick from `CarIdxEstTime` wrapped to ±half-lap.
  - **Class-coded rows**: each row has a left border in the car's class color,
    and a class badge (`GT3` / `GT4` / …) so multi-class traffic is instantly
    distinguishable.
  - **Closing-rate hint** (`⚡`): shown on cars behind the player that are
    lapping ≥ 0.3 s/lap faster than the player **and** within 10 s. The icon
    is red when the closing car is from a different class (the most critical
    multi-class scenario), yellow for a same-class faster car.
  - **Sort order**: cars are sorted by `intervalToPlayer` descending — furthest
    ahead at the top, player in the centre, closest behind just below, furthest
    behind at the bottom — matching the standard iRacing relative overlay
    convention.
  - **Player row**: highlighted in accent green with a `0.0s` gap; shows a
    wrench icon when on pit road.
  - **Empty state**: consistent with the standings screen; prompts to start a
    session or run the mock bridge when no standings data is available.
- **Registry**: `relative` dashboard entry upgraded from `available: false` to
  `available: true` with `Screen: RelativeScreen`
  (`src/dashboards/registry.tsx`).

### Notes

No bridge changes required: `intervalToPlayer` was already computed in the v0.3
standings engine and carried through every tick on `StandingsEntry`. The
relative screen is a pure frontend transform over the existing `standings`
channel.

## [0.4.2] - 2026-07-02

Brand icons upgraded to real manufacturer logos; tire cell gains a compound
wheel icon.

### Changed

- **Real manufacturer SVG logos** replace the hand-crafted geometric
  approximations for 10 brands in `BrandIcon`
  (`src/components/standings/cells.tsx`): Toyota (concentric-ellipse oval/T
  mark), Honda (H letterform in rounded-rectangle badge), Lamborghini (shield
  with detailed interior paths and letter banner), Mercedes (three-pointed star
  in circle), McLaren (Speedmark swoosh), Porsche (quartered crest with rampant
  horse detail), Ford (oval wordmark), BMW (roundel with filled quadrants),
  Ferrari (Prancing Horse shield), and Audi (four interlocking rings). Path
  data sourced from the SVGRepo flat-logo collection; SVGRepo wrapper groups
  stripped, `fill="#000000"` replaced with `fill="currentColor"` throughout,
  and BMW `class` attributes inlined as `fill` for JSX compatibility.

### Fixed

- **Brand icons not rendering**: `BrandIcon` container switched from
  `inline-flex items-center` (does not stretch children) to plain `inline-flex`
  (default `align-items: stretch`) so that `height: 100%` on the SVG child
  resolves correctly against the 13 px container. A `.brand-icon > svg`
  CSS rule in `styles.css` locks `height: 100%; width: auto` centrally.
  Color corrected from a Tailwind opacity modifier (`text-text/55`) to a direct
  `rgba()` inline style for reliable rendering.
- **Tire compound display**: `TireCell` now renders a `TireCompoundIcon` — a
  14×14 px SVG of a tyre viewed from the side (thick sidewall ring, inner rim
  ring, cross spokes) colored by compound — replacing the plain text badge.

## [0.4.1] - 2026-07-02

Standings enrichments: visual car brand identity and live tyre data per car,
making the timing table immediately richer without requiring new bridge
architecture.

### Added

- **Monochrome SVG brand icons** (`src/components/standings/cells.tsx`): a
  `BrandIcon` component that renders an inline, `currentColor` SVG for 20+
  iRacing manufacturers — Audi (four-ring wordmark), BMW (roundel with filled
  quadrants), McLaren (Speedmark double-arc), Mercedes (three-pointed star),
  Ferrari (Scuderia shield), Porsche (quartered crest), Chevrolet (bowtie),
  Cadillac (shield crest), Ford (oval), Toyota (triple ellipse), Honda (H in
  pentagon), Dallara (bold D), Lamborghini (shield with crossed lines), Acura
  (precision A), Mazda (M-wing arcs), Nissan (bar-through-circle), Hyundai
  (H in oval), Subaru (Pleiades cluster), Volkswagen (stacked V/W in circle),
  Lotus (L in ellipse), Radical (R letterform), and Skip Barber (S curve).
  Unknown brands fall back to a muted three-letter pill. Icons are sized at
  11 px tall with proportional width via `width: auto`.
- **Per-car tyre column** in the standings table:
  - **Compound badge** (P / A / B / C) with compound-specific color-coding —
    primary in accent green, alternate in warning yellow, further options in
    danger red / sector purple — derived from the `CarIdxTireCompound` SDK
    array (`bridge/telemetrylab/ingest.py`).
  - **Laps on tyre** counter next to the badge, reset each time a car leaves
    its pit stall (derived by detecting `in_pit_stall → not in_pit_stall`
    state transitions in `StandingsEngine`).
  - `TireCell` component (`src/components/standings/cells.tsx`) and a `tire`
    column in the CSS grid template (`src/components/standings/constants.ts`).
- **Bridge tyre data pipeline**: `CarIdxTireCompound` added to `CAR_IDX_VARS`
  ingest list and propagated through `CarTiming` → `StandingsEntry` →
  WebSocket payload → `StandingsEntry` TypeScript interface → Zustand store.
  Pit-stall transition tracking (`_prev_in_pit_stall`, `_tire_stint_start_lap`)
  added to `StandingsEngine` with reset on session change.
- **Mock bridge** synthesizes compound data cycling every ~20 laps per car so
  the tyre column can be developed without iRacing running.

## [0.4.0] - 2026-07-02

Standings / timing screen: a production-grade, multi-class timing table — the
first major consumer of the v0.3.0 Session & Multi-Car data layer. Built to
broadcast quality and designed so advanced overlays and effects can be layered
on without touching the pipeline. See
[docs/standings-architecture.md](docs/standings-architecture.md).

### Added

- **`StandingsEngine`** (`bridge/telemetrylab/standings.py`): a stateful,
  once-per-tick brain that ships a self-contained snapshot so the client never
  has to remember the previous frame. It computes:
  - **Ordering** by position with a track-progress tiebreak; pace/spectator
    filtering.
  - **Gaps & intervals** — gap-to-leader and interval-to-car-ahead from
    `CarIdxF2Time` (lap-count fallback when lapped), plus **class-relative**
    gap/interval, interval-to-player (`CarIdxEstTime`), and an estimated
    **catch time** from the per-lap closing rate.
  - **Position change** since the green flag and over the last lap (overtake /
    class-overtake detection falls out of the same data).
  - **Projected iRating** — a live Elo-based estimate of gain/loss, clearly
    labelled as an estimate.
  - **Special states** — pit road / pit stall / off-track / not-in-world /
    retired / lapped / class-leader / overall-leader.
  - **Multi-class grouping** — per-class SOF, leader, lap count, fastest lap and
    class order, alongside the authoritative flat order.
- **Sector timing** (`bridge/telemetrylab/sectors.py`): per-car sector splits
  derived from `CarIdxLapDistPct` crossing the `SplitTimeInfo` boundaries, with
  personal-best / overall-best sectors, theoretical best, and purple/green/
  yellow/red grading. Guards discard partial (first-sighting) sectors, skipped
  sectors, and teleports so a split is only ever recorded when a sector was
  entered cleanly at its start.
- **Standings screen** (`src/components/standings/`): a virtualized, 60 fps
  multi-class table with position-change arrows, license + SR badges, iRating +
  projected delta, gap/interval, last/best laps with fastest-lap highlighting,
  colored per-sector deltas, and pit/off-track badges. Class headers with SOF /
  leader / lap count / fastest lap, collapsible classes, class solo-filter, flat
  vs grouped views, and follow-player.
- **Animations**: GPU `translateY` row glides for position swaps, a `sector-pop`
  on new splits, a one-shot purple `lap-flash` on a new overall-fastest lap
  (`prefers-reduced-motion` aware).
- **Stores**: `useStandingsStore` extended (identity-preserved rows, `classes`,
  `meta`, selectors) and a persisted `useStandingsUiStore` for view prefs; a
  full-bleed `Screen` slot in the dashboard registry.

### Changed

- The `standings` channel payload now carries the full multi-class + sector +
  position-change model (see the architecture doc's schema).
- Both bridges read `SplitTimeInfo`; the mock synthesizes a 3-sector track and a
  tighter, race-realistic grid.

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

[Unreleased]: https://github.com/panyu1512/TelemetryLab/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/panyu1512/TelemetryLab/compare/v0.4.2...v0.5.0
[0.4.2]: https://github.com/panyu1512/TelemetryLab/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/panyu1512/TelemetryLab/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/panyu1512/TelemetryLab/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/panyu1512/TelemetryLab/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/panyu1512/TelemetryLab/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/panyu1512/TelemetryLab/releases/tag/v0.1.0
