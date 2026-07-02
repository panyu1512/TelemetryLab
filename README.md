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

> **Status:** v0.1.0 — the end-to-end pipeline works; the dashboard is a
> placeholder. See the [roadmap](ROADMAP.md) (north star: a multi-class
> timing/standings overlay) and the [changelog](CHANGELOG.md).

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

## Project layout

```
.
├── src/                      # React frontend (Vite + TypeScript)
│   ├── components/
│   ├── telemetry/            # Wire protocol, typed models, WS connection
│   ├── stores/               # Zustand stores (session/telemetry/standings/bridge)
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
│   ├── bridge.py             # Real bridge source (Windows, pyirsdk)
│   ├── mock_bridge.py        # Synthetic multi-car field source (Mac/Linux dev)
│   ├── bridge.spec           # PyInstaller config (onefile, console)
│   └── requirements.txt
└── .github/workflows/build.yml
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

## Continuous integration

[`.github/workflows/build.yml`](.github/workflows/build.yml) runs on
`windows-latest` and is triggered by **version tags** (`v*`) or manually
(`workflow_dispatch`). It:

1. Builds the bridge into a onefile `iracing-bridge.exe` with PyInstaller.
2. Copies it to `src-tauri/binaries/iracing-bridge-x86_64-pc-windows-msvc.exe`
   (the exact name Tauri requires for a sidecar: `{name}-{target-triple}.exe`).
3. Runs `npm run tauri build` to produce the `.msi`.
4. Uploads the `.msi` as a workflow artifact, and as a Release asset on tags.

To cut a release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

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
