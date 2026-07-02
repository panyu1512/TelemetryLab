# Standings / Timing Screen — Architecture (v0.4.0)

The v0.4.0 milestone builds a production-grade, multi-class **timing screen** on
top of the Session & Multi-Car data layer from v0.3.0. This document is the
reference for how it is put together: the data flow, the algorithms, what is
**direct from iRacing** vs **derived**, the wire schema, the React store/render
design, and the animation strategy.

> TL;DR — the bridge does the *stateful, correctness-critical* work (ordering,
> gaps, sector timing, position change, projected iRating) once per tick and
> ships a self-contained snapshot; the frontend is a thin, heavily-memoized
> renderer that re-renders only the handful of rows that actually changed.

---

## 1. Architecture at a glance

```
                iRacing shared memory (pyirsdk)                mock_bridge.py
                          │                                          │
                          ▼                                          ▼
        ┌───────────────────────────── TelemetrySource ─────────────────────────┐
        │  poll_connection · read_session_raw · read_player_frame · read_car_arrays │
        └───────────────────────────────────┬───────────────────────────────────┘
                                             │  raw dicts + CarIdx* arrays
                                             ▼
   ┌──────────────────────────────── BridgeService (asyncio) ────────────────────────┐
   │  session loop ~1 Hz     standings loop ~10 Hz          telemetry loop ~60 Hz     │
   │       │                       │                              │                   │
   │  parse_session_info     ingest_car_timings                (player frame)          │
   │       │                       │                              │                   │
   │  SessionRepository      CarRepository ── StandingsEngine ── FieldSectorState      │
   │       │                       │  (cross-tick state: grid, best laps, sectors)    │
   │       └──────── change detection + snapshot cache ──────────┘                    │
   └───────────────────────────────────┬─────────────────────────────────────────────┘
                                        │  versioned channel envelopes (JSON)
                                        ▼
                              WebSocket (ws://…:8765)
                                        │
        ┌───────────────────────────────┼─────────────────────────────────┐
        ▼                               ▼                                  ▼
  useSessionStore              useStandingsStore                    useTelemetryStore
  (roster, rules)        (order + byIdx + classes + meta)          (player frame)
        │                               │
        └────────── StandingsScreen ◀───┘   ClassHeader · StandingsRow (per-car subscribe)
```

Two design rules carry the whole screen:

1. **State lives on the bridge, not the client.** Anything that needs memory
   across frames — the green-flag grid, per-sector personal/overall bests,
   lap-over-lap position change — is computed once in `StandingsEngine` and
   shipped fully-resolved. The client never has to remember the previous frame
   to render the current one.
2. **The client re-renders per-row, not per-table.** The standings store is
   normalized so an unchanged row keeps object identity; a row subscribes to
   *only its own* entry.

---

## 2. Backend services (Python)

| Module | Responsibility |
| --- | --- |
| `telemetrylab/ingest.py` | Fan the `CarIdx*` arrays into one `CarTiming` per car. |
| `telemetrylab/sectors.py` | Derive per-car sector splits from `CarIdxLapDistPct` crossings; track personal/overall best sectors + theoretical best. |
| `telemetrylab/standings.py` | `StandingsEngine`: ordering, gaps/intervals, position change, projected iRating, special states, class grouping. |
| `telemetrylab/repositories.py` | `CarRepository` owns the engine instance + change detection. |
| `telemetrylab/service.py` | The three cadences (session/standings/telemetry). |
| `telemetrylab/parsing.py` | Parses `SplitTimeInfo` → sector boundaries onto `SessionInfo`. |

The engine is **stateful and long-lived** (one per connection); it resets its
history when the `sessionId` changes and retunes sector boundaries when the
track/config changes.

---

## 3. Direct vs derived data

Correctness starts with being honest about provenance.

**Direct from iRacing (passed through untouched):**

- `CarIdxPosition`, `CarIdxClassPosition` → `position`, `classPosition`
- `CarIdxLap`, `CarIdxLapDistPct` → `lap`, `lapDistPct`
- `CarIdxLastLapTime`, `CarIdxBestLapTime` → `lastLapTime`, `bestLapTime`
- `CarIdxF2Time` → the seconds-behind-leader value we base gaps on
- `CarIdxEstTime` → the est-time used for the relative interval-to-player
- `CarIdxOnPitRoad`, `CarIdxTrackSurface` → pit/off-track/in-world states
- `SessionFlags`, `SessionState` → flag colour, "is racing"

**Derived by the bridge:**

- **Gap to leader / interval to car ahead** — from `F2Time` deltas, with a
  lap-count fallback when a car is lapped.
- **Class-relative gap / interval** — difference of two `F2Time` values within a
  class (the class leader's F2 subtracted off).
- **Interval to player** — from `CarIdxEstTime`, wrapped to ±half a lap.
- **Estimated catch time** — `interval ÷ per-lap closing rate`.
- **Position change** (since start / last lap) — from remembered baselines.
- **Sector splits, personal/overall best sectors, theoretical best** — iRacing
  exposes *no* per-opponent sector times; these are timed from lap-distance
  crossings (§6). Quantised to the ~10 Hz tick; marked as derived.
- **Projected iRating change** — an **estimate** from an Elo model (§7).

---

## 4. Standings ordering

```
key(car) = (position?, -(lap + lapDistPct))     # position asc, track-progress desc
```

Cars are sorted by `CarIdxPosition` (authoritative in a race), with track
progress (`lap + lapDistPct`) as a stable tiebreak for the brief windows where
positions are equal/settling (race start, timing transitions). Pace cars and
spectators are filtered out via the roster.

Class grouping is layered on top: the flat overall order stays authoritative,
and `ClassStanding.order` is just the subsequence of each class — so the UI can
render grouped-by-class **or** flat without re-deriving anything.

---

## 5. Gap & interval engine

| Value | Source | Notes |
| --- | --- | --- |
| `gapToLeader` | `F2Time`, else lap-count | `gapIsLaps` flips when ≥1 lap down. |
| `interval` | consecutive `F2Time` delta (overall order) | `null` across a lapped boundary. |
| `gapToClassLeader` | `F2 − classLeaderF2` | class-relative; the screen's default. |
| `classInterval` | consecutive `F2` delta within class | what a driver actually races. |
| `intervalToPlayer` | `EstTime` diff, wrapped ±½ lap | signed; negative = behind player. |
| `estCatchTime` | `interval ÷ (aheadLast − myLast)` | only when genuinely closing. |

**Special situations**

- **Lapped traffic** — once a car is ≥1 lap down, its overall gap is reported as
  a lap count (`gapIsLaps`) and the clean seconds interval becomes `null` (there
  is no meaningful sub-lap interval across a lap boundary). The class-relative
  gap independently reports laps-in-class.
- **Pit lane** — gaps keep updating from `F2Time`, but `estCatchTime` is
  suppressed when either car is on pit road (the pace delta is meaningless).
- **Yellow flags** — under caution the field compresses; we still surface the
  sim's `F2Time`, which is the honest instantaneous gap, and the flag state is
  on the `session` channel so the UI can annotate.

`F2Time` is preferred over hand-rolled est-time math because iRacing already
accounts for partial laps and the leader's position; we only *derive* where the
SDK gives us nothing (class-relative, catch time, player-relative).

---

## 6. Sector timing system

iRacing gives sector boundaries (`SplitTimeInfo.Sectors` → start percentages) but
**no per-opponent sector times**. `CarSectorTracker` derives them:

```
for each tick (pct, lap, ts):
    sector = index_of(pct in starts)
    if crossed into the *next* sector cleanly (entered at its start boundary):
        record  time = ts_now − ts_entered_this_sector
        update personal-best[sector] and field overall-best[sector]
    re-arm timing for the new sector
```

Correctness guards:

- **Partial first sector discarded.** The sector a car is first sighted in was
  joined mid-way, so its time would be short. A sector is only recorded if it was
  *entered at its start boundary* (`_clean`) — this is the fix for the classic
  "impossibly fast opening sector" bug.
- **Skips are dropped.** If a tick gap skips a whole (short) sector, we can't
  attribute a time, so that split is discarded rather than guessed.
- **Teleport / tow / reset** (a large backwards `pct` jump that isn't the
  start/finish wrap) abandons the in-flight sector.

Outputs per sector: `lastTime`, personal `bestTime`, signed `delta`, and a
`status` used for colour. `theoreticalBest` = Σ personal-best sectors.

### 6a. Sector / lap delta colours

| Status | Colour | Meaning |
| --- | --- | --- |
| `overall_best` | **purple** (`--color-sector-purple`) | fastest in the field this session |
| `personal_best` | **green** (`--color-accent`) | this car's own best |
| `slower` | **yellow** (`--color-warning`) | off personal best |
| `much_slower` | **red** (`--color-danger`) | a big time loss (> 0.75 s) |

The status is computed on the bridge so the client never re-derives it; the
frontend keys a small CSS animation on the value so a *new* split fades in and a
new overall-best lap flashes purple (§11).

---

## 7. Position change & projected iRating

**Position change** (the `▲2` / `▼1` indicators):

- `positionsGainedTotal` — `gridPosition − currentPosition`, where `gridPosition`
  is captured the first time a car is seen with a racing position (green flag).
- `positionsGainedLastLap` — the engine snapshots each car's position at every
  lap boundary; the delta over the just-completed lap is held sticky until the
  next boundary.
- **Overtake / class-overtake detection** falls out of the same data: any tick
  where a car's position decreases past another's is an overtake, and if the two
  share a `carClassId` it is a class overtake. The UI animates these for free
  because a changed position moves the row's layout offset (§11).

**Projected iRating** (`iRatingChangeEst`, the `▲14` next to iR) is a genuinely
novel live indicator — and an **estimate**, labelled as such:

```
expectedPlace_i = 1 + Σ_j  P(j finishes ahead of i),   P = 1 / (1 + 10^((iRᵢ − iRⱼ)/1600))
change_i        = round( SCALE · (expectedPlace_i − actualPlace_i) / (N − 1) )
```

Running ahead of your Elo-expected place projects a gain; running behind projects
a loss. It is not iRacing's exact points pool — it is a plausible, honest live
signal that updates every tick.

---

## 8. Special states

Derived from `CarIdxTrackSurface` / `CarIdxOnPitRoad` / positions:

| State | Source |
| --- | --- |
| `onPitRoad` | `CarIdxOnPitRoad` |
| `isInPitStall` | `trackSurface == in_pit_stall` |
| `isOffTrack` | `trackSurface == off_track` |
| `isInWorld` | `trackSurface >= 0` |
| `isRetired` | not-in-world for ≥ ~3 s after having been seen racing |
| `isLapped` | ≥ 1 lap down on the overall leader |
| `isClassLeader` | first car of its class in overall order |
| `isOverallLeader` | overall position 1 |

`isRetired` vs a brief tow is disambiguated by a per-car out-of-world tick timer
in the engine, so a car dipping off the timing loop momentarily is not flashed as
retired.

---

## 9. WebSocket schema

Unchanged envelope (`protocol.py`): `{ v, type, ts, seq, payload }`. The
`standings` channel payload (`StandingsPayload`) gained the multi-class + sector
fields:

```jsonc
{
  "playerCarIdx": 0,
  "sectorCount": 3,
  "overallBestLap": 133.431,
  "overallBestLapCarIdx": 8,
  "overallBestSectors": [45.3, 49.5, 38.7],
  "classes": [
    { "carClassId": 84, "shortName": "GT3", "color": "#ff4d4d", "sof": 2187,
      "carCount": 12, "leaderCarIdx": 16, "leaderLap": 3,
      "fastestLap": 132.9, "fastestLapCarIdx": 16, "order": [16, 7, 12, /*…*/] }
  ],
  "entries": [
    {
      "carIdx": 16, "position": 1, "classPosition": 1, "carClassId": 84,
      "lap": 3, "lapDistPct": 0.42, "lastLapTime": 133.4, "bestLapTime": 132.9,
      "gapToLeader": 0.0, "interval": 0.0, "gapIsLaps": false, "lapsDown": 0,
      "gapToClassLeader": 0.0, "classInterval": 0.0, "classGapIsLaps": false,
      "intervalToPlayer": -15.7, "estCatchTime": null,
      "positionsGainedTotal": 2, "positionsGainedLastLap": 1,
      "iRating": 3200, "iRatingChangeEst": 14,
      "lastLapStatus": "personal_best", "theoreticalBest": 132.1,
      "sectors": [
        { "index": 0, "lastTime": 45.3, "bestTime": 45.3, "delta": 0.0, "status": "overall_best" }
      ],
      "onPitRoad": false, "trackSurfaceLabel": "on_track",
      "isOffTrack": false, "isInPitStall": false, "isInWorld": true,
      "isRetired": false, "isPlayer": false,
      "isOverallLeader": true, "isClassLeader": true, "isLapped": false
    }
  ]
}
```

Change detection: the repository fingerprints the serialized payload and only
publishes when it differs, and the publisher caches the latest snapshot so a
late-joining client renders the full field immediately.

---

## 10. React store & component architecture

**Stores**

- `useStandingsStore` — normalized: `order` (carIdx sequence), `byIdx`
  (identity-preserved rows), `classes`, `meta`. `setStandings` diffs each row
  with `rowEqual` and keeps the old object when nothing changed, so subscribers
  don't re-render. `classes`/`meta` are likewise identity-stable across ticks.
- `useStandingsUiStore` — persisted view prefs (grouping, collapsed classes,
  class filter, follow-player), deliberately separate so toggling a view never
  touches row data.
- `useSessionStore` — the roster; `useDriver(carIdx)` gives a row its static
  name/number/brand/license without re-deriving on every timing tick.

**Selectors**

- `useStandingsRow(carIdx)` — a single row (fast path).
- `useStandingsClasses()` / `useStandingsMeta()` / `useStandingsOrder()` —
  low-churn header/layout inputs.

**Component hierarchy**

```
StandingsScreen                     ← scroll owner + windowing + follow-player
├── StandingsHeader                 ← session/flags/best-lap + view controls
├── ColumnHeader (sticky)           ← shares the grid template with rows
└── virtualized body
    ├── ClassHeader × classes       ← colour, SOF, leader, lap count, collapse/solo
    └── StandingsRow × cars          ← memo; subscribes to its own row + driver
        ├── PosChange · position · number · driver+brand · license
        ├── IRatingCell (+ projected Δ)
        ├── GapCell · IntervalCell (class-relative when grouped)
        ├── LapCell (last, purple/green) · LapCell (best)
        ├── SectorCell × N          ← purple/green/yellow/red
        └── state badge (pit/off)
```

**Virtualization & incremental updates**

- The body is laid out by absolute `translateY(offset)` per item; only items
  within the viewport (± overscan) are mounted. 100+ cars mount ~30 rows.
- A tick that moves three cars re-renders three rows. Everything else is
  reference-equal and React bails out.
- Target budget: 60 Hz telemetry, ≤10 Hz standings, 60 fps UI — the per-frame
  render cost scales with *changes*, not field size.

---

## 11. Animation strategy

The layout deliberately makes motion cheap and declarative:

- **Position swaps** — each row's vertical position is a `transform:
  translateY(top)` with a CSS transition, so when the order changes the row
  *glides* to its new slot on the GPU. No FLIP measuring, no per-frame JS.
- **New sector** — `SectorCell` keys a `sector-pop` fade on the split value, so a
  freshly-timed sector animates in only when it actually changes.
- **Fastest-lap flash** — a new overall-best lap remounts the last-lap cell
  (keyed on the time) and plays a one-shot purple `lap-flash`.
- **Gain/loss arrows, pit/off badges, colour transitions** — all driven by the
  bridge-computed state fields, so they are pure functions of the row and need no
  client-side history.
- `prefers-reduced-motion` disables the non-essential animations.

Because every visual cue is a field on the row (a status, a signed number, a
boolean), richer effects later — battle grouping, proximity glow, momentum bars —
are additive: they read the same state, they don't need new plumbing.

---

## 12. Innovative UX ideas (beyond a classic timing screen)

The state model is intentionally shaped to make these easy to add later without
touching the data pipeline:

- **Live projected iRating** (shipped) — the `▲14` that turns every lap into a
  points story.
- **Momentum indicators** — `positionsGainedLastLap` + short position history →
  a sparkline / arrow that shows who is *trending*, not just who is where.
- **Predictive gap bars** — `estCatchTime` + closing rate → a bar that fills as a
  catch becomes imminent ("DRS-style" threat meter).
- **Animated battle groups** — cluster consecutive rows whose intervals are under
  ~1.0 s into a highlighted "battle" with its own accent.
- **Proximity highlighting** — use `intervalToPlayer` to glow the cars physically
  near the player, bridging standings and the relative screen.
- **Class-overtake callouts** — the overtake detector (§7) can surface a brief
  "P4 → P3 GT3" toast for broadcast overlays.
- **Mini timelines / race-trend** — persist per-lap positions to draw a small
  position-vs-lap trace per driver.

All of these are consumers of the existing snapshot; none require new backend
work beyond what v0.4.0 already ships.
