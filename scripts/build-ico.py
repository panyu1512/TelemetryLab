"""Build src-tauri/icons/icon.ico with crisp small layers.

`tauri icon` scales every .ico layer down from the 1024 master, which turns
the detailed kitten to mush at 16-32 px. This rebuilds the .ico with the
16/24/32 layers taken from the reduced favicon drawing (rendered to
src-tauri/icons/32x32.png by scripts/render-icon.mjs, plus 16 and 24 rendered
here by downscaling a 4x supersample of it) and 48/64/128/256 from the master.

    python3 scripts/build-ico.py      (needs Pillow)
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "src-tauri" / "icons"

small = Image.open(ICONS / "32x32.png").convert("RGBA")
master = Image.open(ICONS / "icon.png").convert("RGBA")

layers = {
    16: small.resize((16, 16), Image.LANCZOS),
    24: small.resize((24, 24), Image.LANCZOS),
    32: small,
}
for size in (48, 64, 128, 256):
    layers[size] = master.resize((size, size), Image.LANCZOS)

big = layers[256]
big.save(
    ICONS / "icon.ico",
    format="ICO",
    sizes=[(s, s) for s in sorted(layers)],
    append_images=[layers[s] for s in sorted(layers) if s != 256],
)
print("wrote", ICONS / "icon.ico", sorted(layers))
