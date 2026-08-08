/**
 * Regenerate the marketing site's product captures from the live app.
 *
 * Every image in `site/assets/` is a real screenshot of this app running on the
 * built-in mock feed — nothing on the page is a mockup or an illustration
 * (`design.md` § The marketing surface). That only stays true if re-shooting
 * them is a single command, so this is it.
 *
 *   npm run dev              # in one terminal — the app on :1420
 *   node site/capture.mjs    # in another
 *
 * Requires `playwright` to be resolvable. It is deliberately NOT a dependency
 * of this project: the app does not need a browser driver to build, and the
 * captures are refreshed by hand when the UI changes, not on every install.
 *
 *   npx playwright@latest install chromium   # once
 *   npx -p playwright@latest node site/capture.mjs
 *
 * Three details matter and are easy to lose:
 *
 *   · `deviceScaleFactor: 2` — the captures are shown at up to 1300 CSS px on
 *     a page that must stay crisp on a retina display.
 *   · `reducedMotion: "reduce"` — rows are positioned by `translateY` with a
 *     220 ms glide, so a capture fired mid-swap catches two rows overlapping.
 *     Reduced motion switches the glide off and every row sits at its offset.
 *   · the fuel capture waits past the first completed lap (~140 s of mock
 *     time). Before that the strategy panel is honestly empty, and an empty
 *     panel is a bad advertisement for a full one.
 */

import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "assets");
const BASE = process.env.SITE_CAPTURE_BASE ?? "http://localhost:1420";

/** One completed mock lap is ~140 s; wait past it so fuel has real numbers. */
const ONE_MOCK_LAP_MS = 175_000;

/**
 * name, route, viewport, and how long to let the feed run before the shutter.
 * Viewports are CSS px; the files land at 2× those dimensions.
 */
const SHOTS = [
  // The hero capture. Narrow on purpose — it doubles as the proof that the
  // table drops columns to fit rather than growing a scrollbar.
  { name: "standings-compact", route: "?overlay=standings", w: 620, h: 372 },
  { name: "standings", route: "?overlay=standings", w: 1180, h: 420 },
  { name: "relative", route: "?overlay=relative", w: 560, h: 452 },
  { name: "dashboard", route: "?overlay=dashboard", w: 1100, h: 620 },
  { name: "manager", route: "", w: 1400, h: 900, wait: 7_000 },
  { name: "fuel", route: "?overlay=fuel", w: 620, h: 340, wait: ONE_MOCK_LAP_MS },
];

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

for (const { name, route, w, h, wait = 9_000 } of SHOTS) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });

  // Turn the mock feed on before the app boots, so the first frame already has
  // a field in it.
  await ctx.addInitScript(() => {
    const KEY = "telemetrylab.config.v1";
    const raw = localStorage.getItem(KEY);
    const cfg = raw ? JSON.parse(raw) : {};
    cfg.globalSettings = { ...(cfg.globalSettings ?? {}), mockDataEnabled: true };
    localStorage.setItem(KEY, JSON.stringify(cfg));
  });

  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto(`${BASE}/${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });

  console.log(
    errors.length ? `${name}: FAILED — ${errors[0]}` : `${name}: ok (${w}×${h} @2x)`
  );
  await ctx.close();
}

await browser.close();
