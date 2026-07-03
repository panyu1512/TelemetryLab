# -*- mode: python ; coding: utf-8 -*-
#
# PyInstaller spec for the iRacing telemetry bridge.
#
# Produces a single self-contained executable (onefile, console=True) named
# `iracing-bridge`. Run from inside the `bridge/` directory:
#
#     pyinstaller bridge.spec
#
# The resulting `dist/iracing-bridge.exe` is copied by CI into
# `src-tauri/binaries/iracing-bridge-x86_64-pc-windows-msvc.exe`.

from PyInstaller.utils.hooks import collect_submodules

# Pull in the full submodule trees so dynamically imported parts of these
# packages (websockets' asyncio/legacy implementations, irsdk + its yaml use)
# are not dropped by the static analysis.
hiddenimports = []
hiddenimports += collect_submodules("websockets")
hiddenimports += collect_submodules("irsdk")
# Our own shared core (imported by bridge.py, but be explicit so nothing in the
# package is dropped by static analysis).
hiddenimports += collect_submodules("telemetrylab")
hiddenimports += ["yaml", "yaml.cyaml"]

# The sidecar is a pure WebSocket telemetry source; the Tauri app serves the
# frontend itself, so no web assets need bundling here.
datas = []

a = Analysis(
    ["bridge.py"],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

# No COLLECT block + passing binaries/datas straight to EXE == onefile build.
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="iracing-bridge",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
