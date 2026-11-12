/**
 * Render the raster brand icons from the kitten SVGs.
 *
 *   node scripts/render-icon.mjs            # writes the PNGs below
 *   npx tauri icon src-tauri/icons/icon.png # regenerate the platform set
 *   node scripts/render-icon.mjs            # again: restores the small sizes
 *   python3 scripts/build-ico.py            # .ico with hand-drawn small layers
 *
 * - src-tauri/icons/icon.png (1024 px) from public/brand/kitten-plate.svg —
 *   the master `tauri icon` scales every platform icon from. After running it,
 *   keep only the files `bundle.icon` in tauri.conf.json lists (plus icon.png)
 *   and delete the android/ios/Square* extras it also writes.
 * - site/apple-touch-icon.png (180 px), same artwork.
 *
 * Needs Playwright with a Chromium (not a project dependency):
 *   npx -p playwright node scripts/render-icon.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const root = fileURLToPath(new URL("..", import.meta.url));
const dataUri = (file) =>
  `data:image/svg+xml;base64,${readFileSync(`${root}${file}`).toString("base64")}`;
const FULL = dataUri("public/brand/kitten-plate.svg");
// Below ~48 px the detailed head turns to mush; those sizes use the reduced
// favicon drawing instead. `tauri icon` would scale them down from the full
// one, so rerun this script AFTER it to put the small ones back.
const SMALL = dataUri("public/favicon.svg");

const OUT = [
  { path: "src-tauri/icons/icon.png", size: 1024, uri: FULL },
  { path: "site/apple-touch-icon.png", size: 180, uri: FULL },
  { path: "src-tauri/icons/32x32.png", size: 32, uri: SMALL },
];

const browser = await chromium.launch();
for (const { path, size, uri } of OUT) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<body style="margin:0;background:transparent"><img src="${uri}" width="${size}" height="${size}" style="display:block"></body>`
  );
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${root}${path}`, omitBackground: true });
  await page.close();
  console.log(`wrote ${path} (${size}px)`);
}
await browser.close();
