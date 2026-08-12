# iRacing Telemetry

A desktop telemetry dashboard for [iRacing](https://www.iracing.com/), built with
**Tauri v2** + **React** and a **Python sidecar** that reads iRacing's shared
memory.

```
iracing-telemetry.exe
├── WebView  → React dashboard (native window)
└── Sidecar → iracing-bridge.exe (Python, reads iRacing shared memory via pyirsdk)
                    ↕ pyirsdk
              iRacing shared memory (Windows)
```

The bridge exposes telemetry over a WebSocket (`ws://localhost:8765`); the React
frontend connects to it and renders the data. On Windows the real bridge talks
to iRacing; on macOS/Linux a **mock bridge** generates synthetic data so you can
develop the UI without a sim.

> **Status:** shipping. Multi-class standings, an on-track relative, fuel
> strategy and a driving cluster, each in its own window. See the
> [roadmap](ROADMAP.md) and the [changelog](CHANGELOG.md).

## Installing on Windows

**[Download TelemetryLab-setup.exe](https://github.com/panyu1512/TelemetryLab/releases/latest/download/TelemetryLab-setup.exe)**
and run it. It installs for the current user only — into `%LOCALAPPDATA%`, with
no Administrator prompt and no installer wizard to click through — and opens
the app when it finishes.

That link always resolves to the newest release, because the build publishes a
copy of the installer under a name that does not carry the version. The
versioned `…-setup.exe` and a `.msi` sit beside it on the
[release page](https://github.com/panyu1512/TelemetryLab/releases/latest); the
`.msi` is the same application packaged for per-machine or managed deployment
and most people do not need it.

**Windows will warn you**, with *"Windows protected your PC"* and a publisher
listed as unknown. That is expected and it is not a false alarm: the installer
is **not code-signed**, so SmartScreen has no publisher to attribute it to and
blocks it by default. Choose **More info → Run anyway**.

You do not have to accept that on trust. Every release is built by
[`build.yml`](.github/workflows/build.yml) and publishes a `SHA256SUMS.txt`
beside the installer, so you can confirm the bytes you downloaded are the bytes
that were built:

```powershell
certutil -hashfile .\TelemetryLab-setup.exe SHA256
```

A build-provenance attestation — which proves the file came from this
repository's own workflow rather than from whoever handed it to you — is wired
up in the same workflow but **only runs while this repository is public**.
GitHub bills artifact attestations for private repositories under Enterprise
Cloud, so the step is gated rather than left to fail a release. If the repo is
public, the release notes carry the `gh attestation verify` command too.

Signing the installer would put a name in that dialog instead of "unknown
publisher". It would **not** remove the warning: since 2024 neither OV nor EV
certificates bypass SmartScreen, and reputation accrues over time either way.
The only route that removes it outright is distributing through the Microsoft
Store as an MSIX, which is recorded as an open question in
[the roadmap](ROADMAP.md).

## Quick start (Docker)

The fastest way to bring up the **dev environment** (mock telemetry + the React
app) with a single command:

```bash
docker compose up --build
# → open http://localhost:1420
```

This runs the mock bridge (`ws://localhost:8765`) and the Vite dev server with
hot reload. Edit files under `src/` and the browser updates live. To simulate
iRacing connecting/disconnecting, set `MOCK_DISCONNECT_EVERY` in
[docker-compose.yml](docker-compose.yml).

> ⚠️ Docker only runs the **development** stack. The Tauri desktop app is a
> native Windows/macOS binary and the **real** bridge needs iRacing's Windows
> shared memory — neither runs in a Linux container. Those are produced by CI
> ([`.github/workflows/build.yml`](.github/workflows/build.yml)). Use the native
> workflows below for the full app.
>
> No sim handy? Turn on **Mock Data** in the Overlay Manager → *Global Settings*
> and the whole UI runs on built-in synthetic telemetry — no bridge required.

## The site

A static download page lives in [`site/`](site/) — plain HTML and two
stylesheets, no build step. Serve the folder:

```bash
python3 -m http.server 4173 --directory site   # → http://localhost:4173
```

Its product screenshots are generated from this app on the mock feed; see
[`site/README.md`](site/README.md) to re-shoot them after a UI change.

## Project layout

```
.
├── site/                     # Static marketing / download page (no build step)
├── src/                      # React frontend (Vite + TypeScript)
│   ├── components/
│   ├── telemetry/            # Wire protocol, typed models, WS connection
│   │   └── protocol.test.ts  # Wire-envelope parser specs
│   ├── stores/               # Zustand stores (session/telemetry/standings/bridge)
│   ├── lib/                  # Pure helpers (format/scales/fuelStrategy) + *.test.ts
│   ├── hooks/
│   │   ├── useBridge.ts      # Owns the WS connection; feeds the stores
│   │   └── useTelemetry.ts   # Single-car compatibility selector
│   ├── config.ts             # Configurable WS host/port (no hardcoded localhost)
│   └── App.tsx
├── src-tauri/                # Tauri (Rust)
│   ├── src/main.rs           # Spawns + supervises the bridge sidecar
│   ├── binaries/             # Sidecar exe goes here (built in CI)
│   ├── capabilities/
│   ├── icons/
│   ├── tauri.conf.json
│   └── Cargo.toml
├── bridge/                   # Python sidecar
│   ├── telemetrylab/         # Shared core: protocol, models, repos, service
│   ├── tests/                # pytest suite (unit + service integration)
│   ├── bridge.py             # Real bridge source (Windows, pyirsdk)
│   ├── mock_bridge.py        # Synthetic multi-car field source (Mac/Linux dev)
│   ├── bridge.spec           # PyInstaller config (onefile, console)
│   ├── pyproject.toml        # pytest / ruff / coverage config
│   ├── requirements.txt      # runtime deps  (requirements-dev.txt = test/lint)
│   └── requirements-dev.txt
└── .github/workflows/
    ├── ci.yml                # Quality gates: lint + typecheck + tests (every push/PR)
    ├── release.yml           # Cut a release: bump + changelog + tag (manual)
    └── build.yml             # Build: Windows .msi on version tags
```

## Prerequisites

- **Node.js** 20+
- **Rust** stable (via [rustup](https://rustup.rs/))
- **Python** 3.11
- Tauri system dependencies — see the
  [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/).
  On Windows that means the **WebView2 runtime** and the **MSVC C++ build tools**.

---

## Development on macOS / Linux (with the mock bridge)

iRacing and `pyirsdk` are Windows-only, so on macOS/Linux you develop the UI
against the mock bridge and run the frontend in a normal browser (the full Tauri
shell isn't used here because the sidecar exe is Windows-only).

```bash
# 1. Install frontend deps
npm install

# 2. Start the mock bridge (only needs `websockets`)
pip install websockets
npm run bridge:mock          # → ws://localhost:8765 streaming fake telemetry

# 3. In another terminal, start Vite
npm run dev                  # → http://localhost:1420
```

Open <http://localhost:1420>. You should see the live dashboard, driven by the
mock bridge's synthetic field.

Useful tweaks:

- Simulate iRacing connecting/disconnecting to test the UI states:
  ```bash
  MOCK_DISCONNECT_EVERY=5 python bridge/mock_bridge.py
  ```
- Point the frontend at a bridge on another machine (e.g. a Windows PC running
  the real bridge) without touching code:
  ```bash
  VITE_WS_HOST=192.168.1.50 VITE_WS_PORT=8765 npm run dev
  ```

---

## Development on Windows (with iRacing)

```bash
# 1. Install frontend deps
npm install

# 2. Install + run the real bridge
pip install -r bridge/requirements.txt
python bridge/bridge.py      # reads iRacing shared memory, serves ws://localhost:8765

# 3. Run the full Tauri app (it will also spawn the bundled sidecar in prod;
#    in dev you can run the bridge manually as above)
npm run tauri dev
```

> In a packaged build, the Tauri app launches `iracing-bridge.exe` automatically
> and kills it on exit. During `tauri dev` it tries to spawn the sidecar from
> `src-tauri/binaries/` — either build it once (see below) or just run
> `python bridge/bridge.py` manually and ignore the "failed to spawn sidecar"
> log line.

### Building the sidecar locally (optional)

```bash
cd bridge
pip install -r requirements.txt
pyinstaller bridge.spec
# → dist/iracing-bridge.exe

# Copy it where Tauri expects it (note the required target-triple suffix):
copy dist\iracing-bridge.exe ..\src-tauri\binaries\iracing-bridge-x86_64-pc-windows-msvc.exe
```

### Building the full installer

```bash
npm run tauri build
# → src-tauri/target/release/bundle/msi/*.msi
```

---

## Overlay Manager

The main app window is a dedicated **Overlay Manager** — it configures,
previews, opens, closes and tracks overlays, and never behaves as an overlay
itself. The architecture is deliberately flat:

```
Overlay Manager (main window) → individual overlay windows
```

A sidebar lists every overlay; selecting one shows its **entire** configuration
inline on one page (Appearance / Visibility / Window) with a **live preview**
that reflects every change instantly — no save or apply step. Each overlay is
**opened and closed directly from the manager** into its own frameless,
always-on-top window; the manager tracks which overlays are open, and edits
propagate to an open overlay window in real time over a cross-window event bus.

Each overlay window remembers its own position, size and lock state and is
restored exactly on the next launch (closing the manager closes every overlay
window; nothing is orphaned). Internally a single view is selected with a URL
param (`?overlay=<id>` / `?widget=<id>`); a hash form (`#overlay=<id>` /
`#/<id>`) is also accepted. During `npm run dev` these open as browser tabs.

### Locking

Any overlay window can be **locked**: it becomes click-through (all mouse input
passes to iRacing) and immovable. Lock state is persisted per window and
propagates to the open window immediately. Press **Ctrl+Shift+L** to toggle the
focused overlay window. (The manager window is never an overlay and is never
locked.)

---

## Testing & quality gates

The pure logic on both sides of the WebSocket is covered by fast, isolated unit
tests — no sim, no socket, no DOM required — plus a small integration test that
drives the bridge service end-to-end with a fake source.

**Python bridge** ([`bridge/`](bridge/)) — [pytest](https://pytest.org) +
[ruff](https://docs.astral.sh/ruff/):

```bash
cd bridge
pip install -r requirements-dev.txt
pytest                 # unit + integration suite, coverage gate at 85%
ruff check .           # lint
ruff format --check .  # formatting
```

Tests live in [`bridge/tests/`](bridge/tests/) and cover session parsing, SOF,
the CarIdx ingest, the derived-sector timer, the stateful standings engine, the
repositories/event bus, and the async service loop (~97% line coverage).

**Frontend** ([`src/`](src/)) — [Vitest](https://vitest.dev) + `tsc`:

```bash
npm install
npm run typecheck       # tsc --noEmit (strict)
npm test                # vitest run
npm run test:coverage   # with coverage thresholds
```

Specs sit next to the code they exercise (`*.test.ts`) and cover the value
formatters, the tyre-heat colour scale, the wire-protocol parser, and the full
fuel-&-strategy solver.

## Continuous integration

Three workflows split the fast feedback loop from the release build:

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) is the **quality-gate**
pipeline. It runs on every push to `main`/`claude/**` and on every pull request,
across two parallel `ubuntu-latest` jobs:

- **bridge** — `ruff check`, `ruff format --check`, and `pytest` with the
  coverage gate.
- **frontend** — `npm run typecheck`, `npm run test:coverage`, and `npm run build`.

Both roll up into a single `ci` status so branch protection can require one
check. Nothing should merge with a red gate.

[`.github/workflows/release.yml`](.github/workflows/release.yml) is the
**release** pipeline — the decision to ship. Run it from the Actions tab (or
`gh workflow run release.yml -f bump=minor`) and pick `patch`/`minor`/`major`,
or `custom` with an exact `X.Y.Z`. It re-runs the frontend gates, then:

1. Bumps the version in `package.json`, `package-lock.json`,
   `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `Cargo.lock` — all
   five must move together, since Tauri stamps the `.msi` from `tauri.conf.json`.
2. Converts the CHANGELOG's `## [Unreleased]` section into a dated
   `## [X.Y.Z]` section and refreshes the compare links. An empty
   `[Unreleased]` aborts the release: there is nothing to ship.
3. Commits `chore(release): vX.Y.Z`, tags `vX.Y.Z`, pushes both, and
   dispatches `build.yml` against the new tag.

The bump/extract logic lives in [`scripts/release.mjs`](scripts/release.mjs)
(`bump` and `notes` modes) so it can be run and tested outside CI.

[`.github/workflows/build.yml`](.github/workflows/build.yml) is the **build**
pipeline. `release.yml` dispatches it against the tag it just pushed; it also
runs on any `v*` tag pushed by hand, or on demand.

> **Why dispatch rather than rely on the tag?** GitHub does not start workflow
> runs from events created with the default `GITHUB_TOKEN` — a rule that stops
> workflows triggering themselves in a loop. A tag pushed by `release.yml` is
> such an event, so `build.yml`'s `push: tags: v*` trigger never fires for it
> and no installer is produced. `workflow_dispatch` is one of the two
> documented exceptions, so `release.yml` calls it explicitly. If a release
> ever lands with no `.msi`, this is the first thing to check.

It runs on `windows-latest` and:

1. Builds the bridge into a onefile `iracing-bridge.exe` with PyInstaller.
2. Copies it to `src-tauri/binaries/iracing-bridge-x86_64-pc-windows-msvc.exe`
   (the exact name Tauri requires for a sidecar: `{name}-{target-triple}.exe`).
3. Runs `npm run tauri build` to produce the `.msi`.
4. Uploads the `.msi` as a workflow artifact, and as a Release asset on tags —
   with that version's CHANGELOG section as the release body, rather than a
   dump of commit subjects.

So a release is one button: run `release`, and the installer and release notes
follow from the tag it pushes.

---

## Wire protocol

Since v0.3.0 the bridge multiplexes several **channels** over the single
WebSocket, each in a versioned envelope so the frontend can route by `type` and
pick a different cadence per channel (never shipping the heavy driver roster at
60 fps):

```jsonc
{ "v": 1, "type": "telemetry", "ts": 1719936000123, "seq": 4211, "payload": { … } }
```

| Channel     | Cadence            | Payload                                                        |
| ----------- | ------------------ | -------------------------------------------------------------- |
| `telemetry` | ~60 Hz             | Player car only: speed/rpm/gear, inputs, tyres, current lap.   |
| `standings` | ~5–10 Hz (on change) | Computed field order: positions, gaps, per-car timing, pit state. |
| `session`   | on change / ~1 Hz  | Driver roster, session/track/weather metadata, flags, SOF.     |
| `bridge`    | on change          | `{ iracingActive }` — replaces the old `{connected:false}` heartbeat. |

Stateful channels (`session` / `standings` / `bridge`) are **replayed on
connect**, so a client that joins mid-session renders the current world
immediately instead of waiting for the next tick.

The models are defined once and mirrored on both sides:

- Python: [`bridge/telemetrylab/models.py`](bridge/telemetrylab/models.py)
  (dataclasses) + [`protocol.py`](bridge/telemetrylab/protocol.py).
- TypeScript: [`src/telemetry/types.ts`](src/telemetry/types.ts) +
  [`protocol.ts`](src/telemetry/protocol.ts).

On the frontend each channel feeds a Zustand store (`useTelemetryStore`,
`useSessionStore`, `useStandingsStore`, `useBridgeStore`); the standings store is
normalized (`order` + `byIdx`) so 100+ rows only re-render when their own numbers
change. `useTelemetry()` remains as a single-car compatibility selector for the
existing dashboard widgets.

The mock bridge synthesizes a full field (`MOCK_CARS`, `MOCK_MULTICLASS`) so the
session/standings/relative screens can be built entirely on macOS/Linux.

---
