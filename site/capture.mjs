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
 *   · leave the working tree alone while it runs. The dev server reloads the
 *     page on an edit anywhere in the repo — the CHANGELOG and `site/`
 *     included — and a reload restarts the mock feed, so a shot taken after
 *     one shows an earlier lap and a shorter fuel-per-lap table than its wait
 *     promises.
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
 * header 42 · [band 30 + gap 4 + 6 rows] · CLASS_GAP 10 · [band 30 + gap 4 +
 * 3 rows] — the other class is capped at three cars by default — with each
 * row a 29 px strip in a 32 px slot, and the last row's strip ending at 404.
 *
 * **Those are full-size numbers, and a narrow shot is not full size.** The
 * timing tables scale themselves to their window now, so below the width its
 * columns want, every one of those boundaries multiplies by the same factor
 * (`lib/tableScale`) — a 620 px standings draws at ~0.61 and its field ends
 * near 300, not 500. Re-measure after any change to `constants.ts` geometry
 * *or* to the scale floor, and re-measure by looking at the file rather than
 * by arithmetic: an over-tall frame shows as a band of empty paper that no
 * test will ever catch.
 *
 * Standings no longer scrolls: it scales to the tighter of width *and* height
 * (`lib/tableScale.fitScale`), so its frame can never crop the field — the
 * table shrinks to fit instead. Height still decides how *large* it draws,
 * and an over-tall frame still leaves empty paper under the last row. So its
 * heights are the *smallest at which the table is still width-limited*: one
 * pixel shorter and it starts shrinking to fit the height instead. Found by
 * stepping the viewport down until the scale moves, not by arithmetic.
 *
 * The relative shot is meant to show a multi-class race with lapped traffic:
 * GT3 rows on the player's lap in white, GT4 rows a lap down in blue with a
 * `-1L` tag, and the player's row as the only highlighted one. The mock pins
 * a lapped GT4 near the player for exactly this (`src/lib/mockData.ts`), but
 * which other cars are in the window drifts with the wall clock — re-read the
 * relative's alt text in `index.html` after a re-shoot.
 */
const SHOTS = [
  // The hero capture. Narrow on purpose — it doubles as the proof that the
  // table *scales* to fit rather than shedding columns or growing a scrollbar:
  // at 620 px every one of the fifteen columns is still there, drawn smaller.
  // (It used to prove the opposite. Columns stopped dropping when the tables
  // learned to scale — see `lib/tableScale`.)
  // 256: at this width the table draws every column at ~0.58, and 255 is the
  // shortest frame that keeps it width-limited (one pixel of slack on top).
  // Down from 306 when the other class was capped at three cars by default,
  // from 272 when the brand column widened for 1.16, and from 269 when the
  // tyre column came back for 1.17 and the table drew a step smaller. Up to
  // 263 (width-limited from 262) for 1.19, when the session strip became a
  // 42 px header and the brand column widened to 4rem.
  { name: "standings-compact", route: "?overlay=standings", w: 620, h: 263 },
  // 444 = the whole two-class field at full size (width-limited from 442;
  // re-measured for 1.19's 42 px session header, up from 428).
  // This capture is the page's proof that the table groups by class; at 420
  // an older layout cropped the GT4 group mid-row.
  { name: "standings", route: "?overlay=standings", w: 1180, h: 444 },
  // 420 fits five cars ahead, the player and four behind, all whole: the
  // tenth row's strip ends at 413 at this width's ~0.93 scale. Widened from
  // 560 for 1.19, when licence and iRating joined the row, so the table is
  // not shrunk by a fifth to make room for them.
  { name: "relative", route: "?overlay=relative", w: 700, h: 420 },
  { name: "dashboard", route: "?overlay=dashboard", w: 1100, h: 620 },
  { name: "manager", route: "", w: 1400, h: 900, wait: PAST_A_LAP_MS },
  // Tall enough for the fuel-per-lap table under the pit strategies — and no
  // taller. The table grows a row a lap, so this shot waits for four: laps
  // 14–17 land at ~19, 47, 75 and 102 s and lap 18 at ~130 s, so 115 s sits
  // between the fourth and the fifth (re-measure both if MOCK_START_OFFSET_S,
  // MOCK_TIME_SCALE or the mock's lap times move). With four rows the table's
  // card ends at 575 (measured in the live app), plus the panel's padding and
  // edge and the window's 8 px. 590, up from 432 for 1.26, when the table
  // arrived; still under the tank's refill at lap 19, so the panel tells the
  // same "pit stop needed" story the page's copy does.
  { name: "fuel", route: "?overlay=fuel", w: 620, h: 590, wait: 115_000 },
  // The coach after the first lap the feed completes: lap 13 is already done
  // when the page opens (and was a new best), lap 14 lands ~20 s in, and its
  // analysis holds until ~47 s. 30 s sits in the middle of that window, so the
  // frame shows tips rather than the new-best banner. Height measured to the
  // corner list's `Lap` row plus the panel's padding — re-measure if the
  // screen's sections change, and re-read the coach alt text in `index.html`:
  // the tips it quotes come off this lap. 419, up from 404 for 1.25's hairline
  // sections: the `Lap` row now ends at 404.
  { name: "coach", route: "?overlay=coach", w: 620, h: 419, wait: 30_000 },
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
  // The pointer sits inside the viewport, so a frameless overlay window draws
  // its hover edge — chrome for finding and moving the window, not part of the
  // overlay. A capture shows the overlay.
  await page.addStyleTag({
    content: "html.overlay-mode #root::after { display: none !important; }",
  });
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });

  console.log(
    errors.length ? `${name}: FAILED — ${errors[0]}` : `${name}: ok (${w}×${h} @2x)`
  );
  await ctx.close();
}

await browser.close();
