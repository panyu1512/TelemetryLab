# Roadmap

Where iRacing Telemetry is going. The north star is a **minimalist, modern**
desktop app whose centerpiece is a data-dense **timing & standings overlay** in
the spirit of [kapps / Kutu][kapps] — where **every overlay is configurable** —
built on the Tauri + React + Python pipeline we already have.

Versions are indicative, not promises. Each milestone notes the **iRacing SDK
data** it depends on, because some screens (anything multi-car) need the bridge
to read far more than today's single-car telemetry.

> Status legend: ✅ done · 🚧 in progress · ⏳ planned · 💡 idea/backlog

---

## Design language

Not a milestone — a constraint that applies to every screen below.

- **Minimalist & modern:** dark, low-chrome, content-first. Data is the UI; no
  skeuomorphism, no clutter. Generous spacing, a single accent (`#00ff88`),
  restrained motion.
- **Design tokens:** one source of truth for color/spacing/typography (CSS
  custom properties) so themes and per-overlay tweaks are trivial.
- **Legibility at a glance:** monospace/tabular numbers, clear hierarchy, high
  contrast — readable in a car at speed and over a livestream.
- **Composable overlays:** each overlay is an independent, self-contained widget
  that can be toggled, themed, positioned and resized on its own.

---

## ✅ v0.1.0 — Foundation

The end-to-end pipeline: bridge → WebSocket → React, packaged into a Windows
installer by CI. Single-car telemetry only. (See the [changelog](CHANGELOG.md).)

---

## ✅ v0.2.0 — Real dashboard widgets

The raw JSON becomes an actual driving dashboard — purely frontend, on the
existing single-car `TelemetryData`. (See the [changelog](CHANGELOG.md).)

- ✅ Speed / RPM / gear cluster with an RPM bar + shift light.
- ✅ Throttle & brake bars, steering indicator.
- ✅ Fuel: level, %, and a simple "laps of fuel left" estimate.
- ✅ Lap timing: current / last / best, with a +/- delta vs best.
- ✅ Tyre temps (LF/RF/LR/RR) with a color heat scale; pressures.
- ✅ Reusable `components/` (Gauge, Bar, StatTile) + a layout grid.

Delivered beyond the checklist: a configurable drag-and-drop / resize widget
grid with an overlay dock + widget manager and an edit mode, a rolling
input-trace graph, and fully responsive (container-query-sized) widgets.

> The RPM redline / shift point and the steering range self-calibrate from
> observed values — the real `DriverCarRedLine` / wheel-range data arrives with
> `DriverInfo` in v0.3.0.

**Needs:** nothing new — current `TelemetryData`.

---

## ✅ v0.3.0 — Session & multi-car data layer

The unglamorous but essential foundation for standings/relative. The bridge now
publishes the **whole field** and the **session**, not just the player.
(See the [changelog](CHANGELOG.md).)

- ✅ Parse `DriverInfo` (the YAML session string) → per-car: name, car number,
  car brand/model, class, iRating, license + safety rating, club, division.
- ✅ Read the `CarIdx*` telemetry arrays (all cars): `CarIdxPosition`,
  `CarIdxClassPosition`, `CarIdxLapDistPct`, `CarIdxLap`, `CarIdxLastLapTime`,
  `CarIdxBestLapTime`, `CarIdxEstTime`, `CarIdxF2Time`, `CarIdxOnPitRoad`,
  `CarIdxTrackSurface`.
- ✅ Session state: `SessionTimeRemain`, `SessionLapsRemain`, `SessionState`,
  decoded `SessionFlags`, plus per-class/overall SOF and track/air temp.
- ✅ Split the WebSocket protocol into versioned channels so the
  heavy/rarely-changing data (driver roster) doesn't ship at 60 fps:
  - `telemetry` — player car, high frequency (~60 Hz).
  - `session` — roster + session info, low frequency (~1 Hz / on change).
  - `standings` — computed field order, medium frequency (~5–10 Hz).
  - `bridge` — connection status; stateful channels replay on connect.
- ✅ Typed TS models (`SessionInfo`, `DriverEntry`, `CarTiming`,
  `StandingsEntry`) + Zustand stores optimized for 100+ rows.
- ✅ Mock bridge synthesizes a full multi-car (multi-class) field.

Delivered beyond the checklist: a source-agnostic bridge core
(`bridge/telemetrylab/`) with repositories + an event bus, so the real and mock
bridges share one code path; a standings computation skeleton with gap/interval
and lapped-car handling; and a relative `deltaToPlayer` ready for v0.5.

**Needs:** `DriverInfo` YAML + `CarIdx*` arrays + `WeekendInfo`.

---

## ✅ v0.4.0 — Standings / timing screen (the reference)

The screen from the [reference image][kapps]. Multi-class timing table.
(See the [changelog](CHANGELOG.md) and
[architecture doc](docs/standings-architecture.md).)

Anatomy of one row:

```
▲2  1  26  Matt J Farrow   [Audi]  A3.45  8895 ▲14   GAP   INT   1:40.2   .3  .7  .7
└pos └P └#  └driver         └brand  └lic   └iR  └Δ   └lead └ahead └last    └sector Δ (colored)
 change
```

- ✅ Multi-class grouping; per-class header with class name, SOF, laps/leader,
  fastest lap; collapse/solo-filter; grouped vs flat views.
- ✅ Position + **position-change** indicator (▲/▼ since session start and last
  lap), with overtake / class-overtake detection.
- ✅ Gap to leader and interval to car ahead (from `CarIdxF2Time`), plus
  class-relative gaps, interval-to-player, and estimated catch time.
- ✅ Last lap, best lap, with **overall fastest lap highlighted** (purple).
- ✅ **Per-sector deltas** with purple/green/yellow/red coloring vs
  personal/overall best (from `SplitTimeInfo` + `CarIdxLapDistPct` tracking),
  plus theoretical best.
- ✅ License + SR badge, iRating + **live projected** delta, car-brand pill.
- ✅ Pit / off-track / lapped / retired states (`CarIdxOnPitRoad`,
  `CarIdxTrackSurface`).

Delivered beyond the checklist: a stateful `StandingsEngine` that ships a fully
self-contained snapshot, a 60 fps virtualized renderer with GPU row-glide
animations, and a state model designed for the momentum/battle/proximity
overlays sketched in the architecture doc.

**Needs:** everything from v0.3.0 + `SplitTimeInfo` for sectors.

---

## ⏳ v0.4.1 — Standings enrichments

Small-batch polish round for the timing screen: visual brand identity and
live tyre data per car — two things that make the table immediately richer
without requiring new bridge architecture.

### Car brand icons

Replace the plain `[AUDI]` text pill with a **color-coded brand badge**:
manufacturer abbreviation on a brand-specific tinted background, so each
manufacturer is visually distinct at a glance.

- A curated `BRAND_META` table maps the `carMake` field (first word of
  `CarScreenName`) to an abbreviation and hue for all major iRacing brands:
  Audi, BMW, Ferrari, Ford, McLaren, Mercedes, Porsche, Toyota, Chevrolet,
  Cadillac, Dallara, Lamborghini, and more.
- Unknown brands fall back to the first three letters on a neutral pill.
- The badge sits inline in the driver name column; no extra grid column needed.

### Per-car tyre info column

A new **Tyre** column after Best Lap shows each car's current tyre state:

- **Compound badge** (P / A / B / …) color-coded by slot — primary in green,
  alternate in yellow, further options in red/purple — driven by iRacing's
  `CarIdxTireCompound` array (series-specific integer).
- **Laps on tyres** — a small counter next to the badge that increments each
  lap and resets when a car exits the pit stall (derived by detecting
  `in_pit_stall → not in_pit_stall` transitions in the standings engine).
- The compound label is intentionally abstract (P/A/B rather than
  "soft/medium/hard") because compound naming varies by series.

**Needs:** `CarIdxTireCompound` added to the `CAR_IDX_VARS` ingest list
(already done) + the pit-stall transition tracker in `StandingsEngine`.

---

## ✅ v0.5.0 — Relative screen

The other classic overlay: the handful of cars physically around you on track,
sorted by relative time gap, with closing rates — invaluable in traffic and
multi-class racing. (See the [changelog](CHANGELOG.md).)

- ✅ Compute relative gaps from `CarIdxEstTime` vs the player (reuses
  `StandingsEntry.intervalToPlayer` — no bridge changes needed).
- ✅ N cars ahead / behind (configurable 3–10, default 5), color-coded by class
  (left border + class badge per row).
- ✅ Closing-rate / "faster class approaching" hint: ⚡ icon for cars behind the
  player that gain ≥ 0.3 s/lap within 10 s, red for different class.

**Needs:** same data layer as v0.3.0.

---

## ⏳ v0.6.0 — Overlay mode

Make the widgets usable *over* iRacing, not just as a standalone window.

- Transparent, always-on-top, click-through overlay window(s).
- Multiple independent widgets/windows (dashboard, standings, relative) with
  persisted position/size/layout.
- Lock/unlock mode: locked = click-through HUD; unlocked = drag/resize to lay
  out.

**Needs:** Tauri multi-window + window decorations/click-through APIs.

---

## ⏳ v0.7.0 — Overlay manager & configuration

The piece from the reference settings UI: a single, minimalist control panel to
**configure every overlay**. This is what turns a set of screens into "an app".

- **Overlay catalog** in a sidebar (Dashboard, Standings, Relatives, Fuel
  Calc…), each with an **enable/disable** toggle and a per-overlay settings
  panel — only the active ones render.
- **Per-overlay appearance:** color theme picker (named themes, e.g. "Obsidian")
  + background **saturation / brightness / opacity** sliders, driven entirely by
  design tokens.
- **Conditional visibility** ("hide when in"): replay screen, lone qualify /
  first lap, in the pits — wired to `SessionState` / `SessionFlags`.
- **Profiles:** named, switchable config sets (practice / qualy / race) you can
  duplicate, rename and delete; everything persisted locally.
- **Per-overlay window controls:** open in its own window, position/size, lock.
- **Browser-source URLs (streamers):** optionally serve each overlay over a
  local HTTP endpoint so it can be dropped into OBS as a browser source
  (`http://127.0.0.1:<port>/overlay/<name>?profile=<profile>`), with copy /
  open-in-browser actions.
- **Global settings:** bridge endpoint (today env-only), plus Debug / Log views
  for troubleshooting the bridge connection.

**Needs:** a small local HTTP server in the app (for the OBS URLs) + persisted
settings store; builds on the overlay windows from v0.6.0.

---

## 💡 Backlog / ideas

- Fuel & strategy calculator (stints, target lap, save %).
- Predictive lap / delta bar (live time gain/loss vs best).
- Input trace graph (throttle/brake/steer over time).
- Track map with live car positions (`CarIdxLapDistPct` + track geometry).
- Session recording & replay of telemetry to a file (great for debugging UI
  without the sim — complements the mock bridge).
- Pit service / black-box info, incident count, weather/grip.
- Cross-platform packaging beyond the `.msi` (NSIS, auto-update feeds).

---

## Cross-cutting concerns

- **Performance:** keep the WebSocket + render budget under one 60 Hz frame;
  diff/throttle channels so React isn't re-rendering the whole field at 60 fps.
- **Resilience:** the bridge already auto-reconnects; the UI should degrade
  gracefully per channel (telemetry live but roster stale, etc.).
- **Testing:** extend the mock bridge to emit a fake multi-car field so v0.3+
  screens can be built entirely on macOS/Linux.

[kapps]: https://kapps.kutu.ru/
