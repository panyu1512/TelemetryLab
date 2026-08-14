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
 *   · the fuel capture's `alt` text in `index.html` quotes numbers off the
 *     panel — fuel laps, litres in tank. The mock feed is wall-clock driven, so
 *     those move on every re-shoot. **Re-read that alt after running this**, or
 *     the page describes a picture it is no longer showing, which is the one
 *     accessibility bug a sighted reviewer cannot see.
 *   · every shot waits for a completed lap, because the two fuel readouts have
 *     no per-lap burn until one lands and an empty panel is a bad
 *     advertisement for a full one. That wait used to be three minutes; the
 *     mock feed now opens fourteen laps into the race and runs five times
 *     wall-clock (`MOCK_START_OFFSET_S` / `MOCK_TIME_SCALE` in
 *     `src/lib/mockData.ts`), so a lap boundary is ~28 s away instead of ~140.
 */

import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "assets");
const BASE = process.env.SITE_CAPTURE_BASE ?? "http://localhost:1420";
/**
 * Comma-separated shot names to re-shoot, or all of them when unset. Every shot
 * waits out a lap boundary, so a full pass is minutes — and most re-shoots are
 * one image whose frame moved.
 *
 *   SITE_CAPTURE_ONLY=standings-compact node site/capture.mjs
 */
const ONLY = process.env.SITE_CAPTURE_ONLY?.split(",").map((n) => n.trim());

/**
 * Long enough for a lap boundary to pass at `MOCK_TIME_SCALE`, so the fuel
 * panels have a measured burn rather than "calibrating…". The feed opens ~29 %
 * into a lap, so the boundary is ~0.71 × 138 s of mock time away — call it 28 s
 * at 5×, and round up for the render.
 */
const PAST_A_LAP_MS = 40_000;

/**
 * name, route, viewport, and how long to let the feed run before the shutter.
 * Viewports are CSS px; the files land at 2× those dimensions.
 */
/*
 * Heights are measured, not guessed.
 *
 * A viewport that ends mid-row is the one way these captures can look sloppy
 * while being perfectly honest: the overlay paints its paper to the full
 * viewport, so a height that falls between two row boundaries crops the last
 * row through its type and the frame closes on a half-glyph. Every height
 * below therefore lands just past a row boundary, with a few px of paper as
 * margin.
 *
 * The boundaries at these widths, from the live app: the standings field runs
 * strip 26 · [band 30 + gap 4 + 6 rows] · CLASS_GAP 10 · [band 30 + gap 4 +
 * 6 rows], with row bottoms at 71 · 107 · 139 … 267 for GT3 and 307 · 343 …
 * 503 for GT4.
 *
 * **Those are full-size numbers, and a narrow shot is not full size.** The
 * timing tables scale themselves to their window now, so below the width its
 * columns want, every one of those boundaries multiplies by the same factor
 * (`lib/tableScale`) — a 620 px standings draws at ~0.61 and its field ends
 * near 300, not 500. Re-measure after any change to `constants.ts` geometry
 * *or* to the scale floor, and re-measure by looking at the file rather than
 * by arithmetic: an over-tall frame shows as a band of empty paper that no
 * test will ever catch.
 */
const SHOTS = [
  // The hero capture. Narrow on purpose — it doubles as the proof that the
  // table *scales* to fit rather than shedding columns or growing a scrollbar:
  // at 620 px every one of the fifteen columns is still there, drawn smaller.
  // (It used to prove the opposite. Columns stopped dropping when the tables
  // learned to scale — see `lib/tableScale`.)
  // 306, down from 381: at this width the table no longer sheds columns, it
  // draws them all at ~0.61 — so the field itself is ~0.61 as tall, and the old
  // frame closed on 75 px of empty paper below the last row.
  { name: "standings-compact", route: "?overlay=standings", w: 620, h: 306 },
  // 512 = the whole two-class field (ends 503). This capture is the page's
  // proof that the table groups by class; at 420 it cropped the GT4 group
  // mid-row, which showed the reader four of six cars and a sliced fifth.
  { name: "standings", route: "?overlay=standings", w: 1180, h: 512 },
  // 472 fits five cars ahead, the player and four behind, all whole. At 452
  // a thirteenth row was sliced by the frame.
  { name: "relative", route: "?overlay=relative", w: 560, h: 472 },
  { name: "dashboard", route: "?overlay=dashboard", w: 1100, h: 620 },
  { name: "manager", route: "", w: 1400, h: 900, wait: PAST_A_LAP_MS },
  // Tall enough for the pit-strategies card, which stopped being collapsed and
  // now always renders under the fold of the old 340 px frame — and no taller:
  // 560 left ~60 px of empty paper below the last card.
  { name: "fuel", route: "?overlay=fuel", w: 620, h: 505, wait: PAST_A_LAP_MS },
];

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

for (const { name, route, w, h, wait = PAST_A_LAP_MS } of SHOTS) {
  if (ONLY && !ONLY.includes(name)) continue;
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
