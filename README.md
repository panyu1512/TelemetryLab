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
│   ├── hooks/
│   │   └── useTelemetry.ts   # WebSocket hook with reconnect + typed telemetry
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
│   ├── bridge.py             # Real bridge (Windows, pyirsdk)
│   ├── mock_bridge.py        # Synthetic data for Mac/Linux dev
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

Open <http://localhost:1420>. You should see the raw telemetry JSON streaming.

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

## Telemetry data

The bridge emits one JSON frame per tick. When iRacing is not running it emits
`{"connected": false}` once per second.

| Field                | Source / notes                                  |
| -------------------- | ----------------------------------------------- |
| `speed` / `speedKmh` | `Speed` (m/s) and its km/h conversion           |
| `rpm`, `gear`        | `RPM`, `Gear`                                    |
| `throttle`, `brake`  | `Throttle`, `Brake` (0–1)                        |
| `steeringWheelAngle` / `steeringDeg` | `SteeringWheelAngle` (rad) + degrees |
| `fuelLevel`, `fuelLevelPct` | `FuelLevel`, `FuelLevelPct`               |
| `lapCurrentLapTime`, `lapBestLapTime`, `lapLastLapTime`, `lap` | lap timing |
| `playerCarPosition`  | `PlayerCarPosition`                              |
| `latAccel`, `lonAccel` | `LatAccel`, `LonAccel` (m/s²)                  |
| `onPitRoad`          | `OnPitRoad`                                       |
| `sessionTime`        | `SessionTime`                                     |
| `airTemp`, `trackTemp` | `AirTemp`, `TrackTemp`                          |
| `tyres.{lf,rf,lr,rr}` | per-tyre carcass temps (`tempL/M/R`) + `pressure` |

The full TypeScript type lives in
[`src/hooks/useTelemetry.ts`](src/hooks/useTelemetry.ts).

---

## License

MIT
