# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Automated test suite & CI quality gates** — the project now has real,
  enforced quality gates on both sides of the WebSocket.
  - **Python bridge tests** (`bridge/tests/`, pytest): ~155 unit + integration
    tests covering session parsing and Strength-of-Field, the CarIdx ingest and
    relative-delta wrapping, the derived per-car sector timer and field board,
    the stateful standings engine (order, gaps, laps-down, position change,
    retirement, class grouping), the repositories and event bus, model
    `to_dict()` camelCase serialization, and an end-to-end `BridgeService`
    integration test driven by a fake source/publisher. ~97% line coverage,
    gated at 85%.
  - **Frontend tests** (`src/**/*.test.ts`, Vitest): full coverage of the value
    formatters (`lib/format.ts`), the tyre-heat colour scale (`lib/scales.ts`),
    the wire-protocol envelope parser (`telemetry/protocol.ts`), and the
    fuel-&-strategy solver (`lib/fuelStrategy.ts`) — 67 specs, 99% statement /
    97% branch coverage on the tested modules, with thresholds enforced.
  - **Tooling & config**: `bridge/pyproject.toml` (pytest, ruff lint/format,
    coverage) with a `requirements-dev.txt`; `vitest.config.ts` and new
    `typecheck` / `test` / `test:coverage` npm scripts. The existing bridge
    source was normalized with `ruff format` and cleaned of lint findings.
  - **CI pipeline** (`.github/workflows/ci.yml`): a new quality-gate workflow
    that runs on every push to `main`/`claude/**` and every pull request, with
    parallel `bridge` (ruff + pytest) and `frontend` (typecheck + vitest +
    build) jobs rolling up into a single required `ci` status. The existing
    `build.yml` remains the tag-triggered Windows `.msi` release build.

- **Fuel & Strategy Calculator** — a new full-bleed overlay screen (backlog
  Feature 1) that turns raw fuel telemetry into live race strategy. Registered
  in the dashboard catalog as **Fuel Calc**, so it appears in the dock and the
  Overlay Manager (appearance / visibility / window / browser-source) with no
  extra wiring.
  - **Pure calculation core** (`src/lib/fuelStrategy.ts`): a total,
    side-effect-free `computeFuelStrategy()` that derives consumption, laps of
    fuel (raw + above a safety reserve), a finish prediction (surplus/deficit
    litres and whole-lap margin), the fuel-save % and target L/lap needed to
    reach the flag, the current stint framing + pit window, and one or two
    candidate stint plans. Any missing input collapses only the dependent
    outputs to `null` — it never throws.
  - **Strategy planners**: a greedy fewest-stops plan (run to the reserve, then
    add only what the rest of the race needs, capped at a full tank or a fixed
    manual fill) plus an even-split alternative with one extra stop for a
    lighter car / shorter stints. Both are loop-guarded and terminate.
  - **`useFuelStrategy` hook** (`src/hooks/useFuelStrategy.ts`): samples per-lap
    burn and lap time over a rolling window at each lap boundary, infers tank
    capacity from `level ÷ fraction` while the tank is full, anchors the stint
    to the last pit-road exit, and latches an out-of-fuel condition (cleared on
    refuel). Feeds a clean snapshot into the pure core.
  - **`FuelStrategyScreen`** (`src/components/fuel/FuelStrategyScreen.tsx`):
    tank bar with a reserve marker, a color-coded prediction banner
    (calibrating / finish / save / pit / empty), a stint card with progress +
    pit window + margin, a fuel-save card, a collapsible pit-strategies list,
    and a manual per-stop **pit-fuel override** (auto or a fixed litre amount)
    plus an adjustable safety **reserve**.
  - **Edge cases** handled: first lap with no data (estimated framing +
    "calibrating"), timed races (laps-to-flag estimated from `sessionTimeRemain`
    ÷ average lap time), lap-limited races (uses `sessionLapsRemain` directly),
    a dynamically-updating burn rate, an empty tank ("pit immediately" alert),
    and a session reset (all samples cleared).

- **Per-overlay windows** — "Open in new window" (Window tab) pops an overlay
  out on its own via a new `?overlay=<id>` route that renders just that overlay
  with no dock/manager/title-bar chrome. On the desktop build it spawns a real
  always-on-top Tauri window (`src/lib/overlayWindows.ts` +
  `capabilities/overlay.json`); in a browser it opens the same URL in a new tab.
  Each window applies the overlay's own theme + appearance
  (`src/components/OverlayWindow.tsx`).
- **Working browser-source links** — the Browser Source tab now generates real,
  copy-pasteable URLs from the address the app is actually served on (a
  full-app link plus one per overlay), so "see everything in the browser" works
  in any browser and as an OBS Browser Source. Replaces the previous URLs that
  pointed at a local HTTP server that didn't exist.
- **Global theme selector** in Global Settings, so the profile-wide default
  theme can actually be set (previously only an unwired per-overlay picker
  existed).

### Fixed

- **Theme switching did nothing.** The Appearance tab's theme picker set a
  per-overlay `themeId` that was never applied to the DOM (the app only ever
  applied the *global* theme, which no UI set). The active overlay's *effective*
  theme (own override, else global) is now applied live, so both the per-overlay
  picker and the new global selector take effect immediately.
- **Appearance sliders looked broken.** The custom overlaid fill/thumb rendered
  a barely-visible handle that read like a progress bar; replaced with clean
  native range inputs themed via `accent-color`.

## [0.7.0] - 2026-07-02

Overlay Manager & Configuration: a full-screen control panel that transforms the set of individual overlay screens into a cohesive, configurable application. Every overlay is now independently configurable for appearance, visibility, and streaming.

### Added

- **Full-screen Overlay Manager** (`src/components/manager/ManagerWindow.tsx`):
  a centered 1000×700 dialog that opens over the dashboard via the dock's
  slider icon (replaces the previous small floating widget panel). Closes with
  Escape or a backdrop click.
  - **Overlay catalog sidebar** — lists Dashboard, Standings, and Relative with
    per-overlay enable/disable mini-toggles and an active-item highlight.
  - **Profile selector dropdown** in the header with inline create / rename /
    duplicate / delete / export (JSON) / import actions.
  - **Four per-overlay tabs**: Appearance · Visibility · Window · Browser Source.
  - **Bottom sidebar nav**: Global Settings and Debug sections.
  - **Footer status bar** mirrors the connection state (bridge connected / live / waiting).

- **Theme system** (`src/themes/index.ts`):
  four named design-token bundles — Obsidian (default, green), Neon (magenta),
  Classic Dark (sapphire), Midnight (amber) — each specifying all color tokens.
  `applyTheme()` injects them as inline CSS custom properties on `<html>`,
  overriding the `@theme` stylesheet defaults so all Tailwind utilities and
  `var(--color-*)` references update instantly. `clearThemeOverrides()` reverts.
  Theme switches animate via a `:root` CSS transition (220 ms ease).

- **`useOverlayConfigStore`** (`src/stores/useOverlayConfigStore.ts`):
  the central v0.7.0 Zustand store, fully persisted to `localStorage`:
  - **Profiles** — `createProfile`, `duplicateProfile`, `renameProfile`,
    `deleteProfile`, `setActiveProfile`, `exportProfile` (JSON string),
    `importProfile` (parses and re-IDs to avoid collisions). Always keeps at
    least one profile; "Default" created on first launch.
  - **Per-overlay settings** scoped to the active profile:
    `enabled`, `appearance` (themeId override, saturation 0–200, brightness
    0–200, opacity 0–100), `visibility` rules (hideOnReplay, hideOnPits,
    hideOnLoneQualify). Each is mutated via a typed setter and immediately
    re-persisted.
  - **Global settings**: active theme, bridge endpoint (ws://127.0.0.1:8765),
    HTTP server port (9999), server/browser-source enable toggles, log level,
    and a randomly-generated auth key for OBS URL protection.
  - On module load the persisted theme is applied synchronously (before React
    hydrates) so there is no flash of the default theme.

- **Appearance panel** (`src/components/manager/AppearancePanel.tsx`):
  - **Theme picker** — 2-column grid of theme cards with bg→accent gradient
    swatches; active theme highlighted with an accent border; "global" badge on
    the inherited theme; one-click override or reset.
  - **Saturation / Brightness / Opacity sliders** — custom-styled range inputs
    with a filled track, themed thumb, numeric readout, and per-slider reset.
    Defaults: sat=100, bri=100, opacity=100 (no-op).
  - **Live preview card** — a miniature telemetry widget rendered with the
    effective theme's colors and the combined `filter: saturate() brightness()`
    + `opacity` applied, so the user sees the exact result before saving.

- **Visibility rules panel** (`src/components/manager/VisibilityPanel.tsx`):
  - Three rule checkboxes (Replay, In Pits, Lone Qualify / first lap) with
    descriptive labels and an "Active now" warning badge pulled from live
    `useSessionStore` flags.
  - Current session snapshot (type, state, track, driver count, flags).
  - A live status pill: "would be hidden / visible in the current session."

- **Window controls panel** (`src/components/manager/WindowPanel.tsx`):
  - Overlay-mode toggle (always-on-top + transparent background).
  - Lock toggle (click-through; Ctrl+Shift+L shortcut noted).
  - Open-overlay action button (switches the active dashboard and closes the
    manager) and an info note about per-window multi-overlay support coming in a
    future release.

- **Browser source panel** (`src/components/manager/BrowserSourcePanel.tsx`):
  - HTTP server status badge and enable toggle.
  - Full per-overlay OBS URL (`http://127.0.0.1:<port>/overlay/<id>?profile=…&key=…`)
    with copy-to-clipboard and open-in-browser buttons.
  - Auth-key display with show/hide and regenerate actions.
  - Quick-list of all overlay URLs for convenient OBS setup.

- **Global settings panel** (`src/components/manager/GlobalSettingsPanel.tsx`):
  - Bridge endpoint text input (synced to global settings store).
  - HTTP server port, server/browser-sources enable toggles.
  - Auth-key field with show/hide and regenerate.
  - Log-level selector (debug / info / warn / error).

- **Debug panel** (`src/components/manager/DebugPanel.tsx`):
  - Connection status tiles (Bridge WS, iRacing, protocol version).
  - Live session snapshot (type, state, track, SOF, flags).
  - Telemetry frame snapshot (speed, RPM, gear, throttle, brake, fuel, lap, position).
  - Real-time log viewer with level filter (all/debug/info/warn/error), auto-scroll
    toggle, clear button, and export-to-file (`.log`) download.

- **`src/lib/debugLog.ts`**: module-level append-only ring buffer (300 entries)
  with `pushLog`, `getLog`, `clearLog`, and `subscribeLog` (React-friendly
  external-store subscription). Imported by `BridgeConnection` to record
  connect / disconnect / iRacing-start / iRacing-stop events, and by
  `DebugPanel` to drive the live log viewer.

- **Conditional visibility in `App.tsx`**: the main content area gets
  `visibility: hidden` in overlay mode when the active overlay's visibility
  rules fire (replay / lone qualify conditions matched against live session
  flags). Appearance filter (`filter: saturate() brightness()` + `opacity`) is
  applied as an inline style on the main content area, live-previewing the
  active overlay's adjusted look.

- **Manager entrance animation** (`styles.css`): `@keyframes manager-in` —
  scale from 0.97 + 8 px translateY → full size; applied to the backdrop
  container on mount. `:root` CSS transition on color/border/background
  properties (220 ms ease) so theme switches animate smoothly.

### Changed

- **Dock** (`src/components/layout/Dock.tsx`): the widget manager button now
  uses a `SlidersHorizontal` icon and the tooltip reads "Overlay Manager
  (v0.7)" to reflect the promoted scope. It opens the new full-screen
  `ManagerWindow` instead of the small floating panel.
- **`App.tsx`** no longer renders the old `OverlayManager` floating card.
  The `ManagerWindow` portal renders at the top of the React tree (above the
  locked-pill indicator) so it is never occluded.

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
