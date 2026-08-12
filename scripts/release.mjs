#!/usr/bin/env node
// Release plumbing. Two modes, both driven by .github/workflows/release.yml:
//
//   node scripts/release.mjs bump <major|minor|patch|X.Y.Z>
//     Rolls the version across package.json, package-lock.json,
//     src-tauri/tauri.conf.json, src-tauri/Cargo.toml and Cargo.lock, then
//     converts the CHANGELOG's [Unreleased] section into a dated release
//     section and refreshes the compare links at the bottom.
//
//   node scripts/release.mjs notes <X.Y.Z>
//     Prints that version's CHANGELOG section to stdout, so the GitHub
//     release body is the changelog rather than a dump of commit subjects.
//
// The four version files must never drift apart: Tauri stamps the .msi from
// tauri.conf.json, so a bump that misses it ships an installer labelled with
// the previous version.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "https://github.com/panyu1512/TelemetryLab";

const read = (p) => readFileSync(join(root, p), "utf8");
const write = (p, s) => writeFileSync(join(root, p), s);

const die = (msg) => {
  console.error(`release: ${msg}`);
  process.exit(1);
};

/** Resolve a bump keyword (or an explicit version) against the current one. */
function nextVersion(current, spec) {
  if (/^\d+\.\d+\.\d+$/.test(spec)) return spec;
  const [major, minor, patch] = current.split(".").map(Number);
  if (spec === "major") return `${major + 1}.0.0`;
  if (spec === "minor") return `${major}.${minor + 1}.0`;
  if (spec === "patch") return `${major}.${minor}.${patch + 1}`;
  return die(`unknown bump "${spec}" — expected major, minor, patch or X.Y.Z`);
}

// -----------------------------------------------------------------------------
// Version files
// -----------------------------------------------------------------------------

/**
 * Rewrite the first `count` `"version": "<current>"` fields textually rather
 * than by re-serialising: JSON.stringify would reflow unrelated formatting in
 * tauri.conf.json and package-lock.json and bury the real change in noise.
 * package-lock carries the version twice (root and its own `packages[""]`).
 */
function bumpJson(path, current, version, count = 1) {
  const src = read(path);
  let seen = 0;
  const out = src.replace(
    new RegExp(`"version": "${current.replace(/\./g, "\\.")}"`, "g"),
    (match) => (seen++ < count ? `"version": "${version}"` : match),
  );
  if (seen < count) die(`expected ${count} version field(s) in ${path}`);
  write(path, out);
}

/** Replace the version in the [package] table only — never a dependency's. */
function bumpCargoToml(version) {
  const src = read("src-tauri/Cargo.toml");
  let replaced = false;
  const out = src.replace(/^version = ".*"$/m, () => {
    replaced = true;
    return `version = "${version}"`;
  });
  if (!replaced) die("no version field found in src-tauri/Cargo.toml");
  write("src-tauri/Cargo.toml", out);
}

/** Keep Cargo.lock in step so `tauri build` doesn't rewrite it mid-release. */
function bumpCargoLock(version) {
  const src = read("src-tauri/Cargo.lock");
  const out = src.replace(
    /(name = "iracing-telemetry"\nversion = ")[^"]*(")/,
    `$1${version}$2`,
  );
  if (out === src) die("iracing-telemetry entry not found in Cargo.lock");
  write("src-tauri/Cargo.lock", out);
}

// -----------------------------------------------------------------------------
// CHANGELOG
// -----------------------------------------------------------------------------

/** Body of one `## [x]` section, minus the heading. */
function section(changelog, heading) {
  const start = changelog.indexOf(`## [${heading}]`);
  if (start === -1) return null;
  const from = changelog.indexOf("\n", start) + 1;
  const next = changelog.indexOf("\n## [", from);
  return changelog.slice(from, next === -1 ? undefined : next).trim();
}

function rollChangelog(version, previous) {
  const src = read("CHANGELOG.md");
  const unreleased = section(src, "Unreleased");
  if (unreleased === null) die("no [Unreleased] section in CHANGELOG.md");
  if (!unreleased) die("[Unreleased] is empty — nothing to release");

  const today = new Date().toISOString().slice(0, 10);

  // Leave an empty [Unreleased] behind for the next cycle.
  let out = src.replace(
    /## \[Unreleased\]\n/,
    `## [Unreleased]\n\n## [${version}] - ${today}\n`,
  );

  // Was there a released version in the log before this one? If not, this
  // release opens the log, and there is no earlier tag to compare against —
  // link the release itself instead. A compare link against a tag that was
  // never pushed (or has since been deleted) is a 404 in the one file whose
  // job is to be a reliable index of what shipped.
  const isFirst = !/^## \[\d+\.\d+\.\d+\]/m.test(src);

  const links =
    `[Unreleased]: ${REPO}/compare/v${version}...HEAD\n` +
    (isFirst
      ? `[${version}]: ${REPO}/releases/tag/v${version}`
      : `[${version}]: ${REPO}/compare/v${previous}...v${version}`);

  // Compare links: [Unreleased] now starts at the new tag, and the new
  // version gets its own line above the previous one.
  if (/^\[Unreleased\]: .*$/m.test(out)) {
    out = out.replace(/^\[Unreleased\]: .*$/m, links);
  } else {
    // A log that has never been released has no link block yet. Append one
    // rather than silently rolling the section and dropping the links — which
    // is what a bare `.replace()` with no match does.
    out = `${out.replace(/\s+$/, "")}\n\n${links}\n`;
  }

  write("CHANGELOG.md", out);
}

// -----------------------------------------------------------------------------

const [mode, arg] = process.argv.slice(2);

if (mode === "notes") {
  if (!arg) die("usage: release.mjs notes <X.Y.Z>");
  const body = section(read("CHANGELOG.md"), arg.replace(/^v/, ""));
  if (!body) die(`no CHANGELOG section for ${arg}`);
  process.stdout.write(`${body}\n`);
} else if (mode === "bump") {
  if (!arg) die("usage: release.mjs bump <major|minor|patch|X.Y.Z>");
  const current = JSON.parse(read("package.json")).version;
  const version = nextVersion(current, arg);
  if (version === current) die(`already at ${version}`);

  bumpJson("package.json", current, version);
  bumpJson("package-lock.json", current, version, 2);
  bumpJson("src-tauri/tauri.conf.json", current, version);
  bumpCargoToml(version);
  bumpCargoLock(version);
  rollChangelog(version, current);

  // Consumed by the workflow to name the commit, tag and release.
  console.log(version);
} else {
  die("usage: release.mjs <bump|notes> <arg>");
}
