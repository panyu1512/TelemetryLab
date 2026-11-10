/**
 * Record the trailer's product footage from the live app.
 *
 * Every moving picture of the product in the trailer is the real app running on
 * its built-in mock feed — the same rule the site's captures follow
 * (`site/capture.mjs`), extended to video. This script shoots them.
 *
 *   npm run dev                                        # the app on :1420
 *   npx -p playwright@latest node trailer/scripts/record-footage.mjs
 *
 * It needs `playwright` resolvable and `ffmpeg` on the PATH; neither is a
 * project dependency, for the reason `site/capture.mjs` gives.
 *
 * A screen recording would drop and double frames, so nothing here runs in real
 * time. The page's clock is Playwright's fake one: each film frame advances it
 * by exactly 1/30 s, lets React paint, steps every CSS transition by the same
 * 1/30 s, and only then takes the screenshot. The mock feed is a pure function
 * of `Date.now()`, so the same script shoots the same frames every run — the
 * session clock on screen included, which is why the start time is pinned.
 *
 *   FOOTAGE_ONLY=standings,radar   re-shoot a subset
 *   FOOTAGE_BASE=http://…          the app somewhere other than :1420
 */

import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "assets", "footage");
const BASE = process.env.FOOTAGE_BASE ?? "http://localhost:1420";
const ONLY = process.env.FOOTAGE_ONLY?.split(",").map((n) => n.trim());
const FPS = 30;

/** The wall clock the session header shows when the feed opens. */
const T0 = new Date("2026-06-14T14:00:00").getTime();

/**
 * name · route · viewport (CSS px) · device scale · `warm` seconds of feed
 * before the first frame · `dur` seconds recorded.
 *
 * Viewports are the site captures' own (see the measurements in
 * `site/capture.mjs`), so a frame of footage and a still on the page are the
 * same picture. The scale is what the trailer's tightest crop of that shot
 * needs to stay at or above 1:1 on a 1920 px frame.
 */
const SHOTS = [
  { name: "cluster", route: "?widget=cluster", w: 640, h: 230, scale: 3, warm: 6, dur: 9 },
  { name: "inputs", route: "?widget=inputs", w: 640, h: 230, scale: 3, warm: 6, dur: 9 },
  { name: "standings", route: "?overlay=standings", w: 1180, h: 444, scale: 2, warm: 44, dur: 12 },
  { name: "relative", route: "?overlay=relative", w: 700, h: 420, scale: 3, warm: 47, dur: 9 },
  { name: "fuel", route: "?overlay=fuel", w: 620, h: 618, scale: 3, warm: 121, dur: 13 },
  { name: "coach", route: "?overlay=coach", w: 620, h: 419, scale: 3, warm: 11, dur: 9 },
  { name: "radar", route: "?widget=radar", w: 460, h: 220, scale: 3, warm: 4, dur: 10 },
];

/** Resolves after the page has had a real task to paint in — the fake clock
 *  owns `setTimeout` and `requestAnimationFrame`, so neither can be the wait. */
const settle = (page) =>
  page.evaluate(
    () =>
      new Promise((done) => {
        const { port1, port2 } = new MessageChannel();
        port1.onmessage = () => done();
        port2.postMessage(0);
      }),
  );

/** Advance every CSS transition and animation by `ms`. They run on the
 *  compositor's clock, which the fake clock does not reach, so each is paused
 *  the first frame it is seen and walked forward by hand after that. */
const stepAnimations = (page, ms) =>
  page.evaluate((dt) => {
    const seen = (window.__footageSeen ??= new WeakSet());
    for (const a of document.getAnimations()) {
      if (!seen.has(a)) {
        seen.add(a);
        a.pause();
        a.currentTime = 0;
        continue;
      }
      const end = a.effect?.getComputedTiming().endTime ?? 0;
      const next = Number(a.currentTime ?? 0) + dt;
      if (Number.isFinite(Number(end)) && next >= Number(end)) a.finish();
      else a.currentTime = next;
    }
  }, ms);

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

for (const shot of SHOTS) {
  const { name, route, w, h, scale, warm, dur } = shot;
  if (ONLY && !ONLY.includes(name)) continue;

  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: scale,
  });
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

  await page.clock.install({ time: T0 });
  await page.goto(`${BASE}/${route}`, { waitUntil: "networkidle" });
  await page.clock.pauseAt(T0 + 5_000);
  // The frameless window's hover edge is chrome for finding the window, not
  // part of the overlay — see site/capture.mjs.
  await page.addStyleTag({
    content: "html.overlay-mode #root::after { display: none !important; }",
  });

  // Let the feed run up to the first frame, a second at a time so every lap
  // boundary on the way is seen (the fuel and coach panels are built from them).
  for (let s = 0; s < warm; s++) {
    await page.clock.runFor(1000);
    await settle(page);
  }
  await stepAnimations(page, 60_000);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `tl-footage-${name}-`));
  const frames = Math.round(dur * FPS);
  let clock = 0;
  for (let i = 0; i < frames; i++) {
    // Whole milliseconds, from the frame index — never a rounded step added up.
    const target = Math.round(((i + 1) * 1000) / FPS);
    await page.clock.runFor(target - clock);
    await settle(page);
    await stepAnimations(page, target - clock);
    clock = target;
    await page.screenshot({ path: path.join(dir, `${String(i).padStart(5, "0")}.png`) });
  }
  await ctx.close();

  // 4:4:4 so one-pixel coloured type (a red delta, a class bar) keeps its hue;
  // tagged BT.709 so the renderer's decode lands back on the app's own greys.
  execFileSync(
    "ffmpeg",
    [
      "-y", "-loglevel", "error",
      "-framerate", String(FPS), "-i", path.join(dir, "%05d.png"),
      "-vf", "scale=out_color_matrix=bt709:out_range=tv",
      "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-g", String(FPS),
      "-pix_fmt", "yuv444p",
      "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
      "-movflags", "+faststart", "-an",
      path.join(OUT, `${name}.mp4`),
    ],
    { stdio: "inherit" },
  );
  fs.rmSync(dir, { recursive: true, force: true });

  console.log(
    errors.length
      ? `${name}: FAILED — ${errors[0]}`
      : `${name}: ok (${w * scale}×${h * scale}, ${frames} frames)`,
  );
}

await browser.close();
