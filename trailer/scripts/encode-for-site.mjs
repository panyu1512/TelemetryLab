/**
 * Encode the rendered masters for the site.
 *
 *   npm run render && npm run render:es   # → out/trailer-{en,es}.mp4
 *   npm run site                          # → ../site/assets/
 *
 * The masters are large and stay out of git (`out/` is ignored). What the site
 * serves is a second, smaller encode of each: H.264 High in an MP4 with the
 * index at the front, which every browser the page supports plays from a
 * static host with no range tricks. CRF 23 is where this film's dark, flat
 * frames stop showing banding in the paper. The audio is the master's AAC,
 * copied rather than encoded a second time, so its measured peaks stay put.
 *
 * The poster is one frame, shared by both languages: 29.967 s, the last frame
 * of the payoff with no line of copy on it — five windows, the radar lit, the
 * pointer on it.
 */

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "..", "out");
const SITE = path.join(HERE, "..", "..", "site", "assets");

const ffmpeg = (...args) =>
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });

for (const [master, served] of [
  ["trailer-en.mp4", "trailer.mp4"],
  ["trailer-es.mp4", "trailer-es.mp4"],
]) {
  const src = path.join(OUT, master);
  if (!fs.existsSync(src)) {
    console.log(`${master}: not rendered — skipped`);
    continue;
  }
  const dst = path.join(SITE, served);
  ffmpeg(
    "-i", src,
    "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-g", "60", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
    "-c:a", "copy",
    "-movflags", "+faststart",
    dst,
  );
  console.log(`${served}: ${(fs.statSync(dst).size / 1e6).toFixed(1)} MB`);
}

const en = path.join(OUT, "trailer-en.mp4");
if (fs.existsSync(en)) {
  const poster = path.join(SITE, "trailer-poster.jpg");
  ffmpeg("-ss", "29.967", "-i", en, "-frames:v", "1", "-q:v", "3", poster);
  console.log(`trailer-poster.jpg: ${(fs.statSync(poster).size / 1e3).toFixed(0)} kB`);
}
