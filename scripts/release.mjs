#!/usr/bin/env node
// Release plumbing. Two modes, both driven by .github/workflows/release.yml:
//
//   node scripts/release.mjs bump <major|minor|patch|X.Y.Z>
//     Rolls the version across package.json, package-lock.json,
//     src-tauri/tauri.conf.json, src-tauri/Cargo.toml and Cargo.lock, then
//     converts the CHANGELOG's [Unreleased] section into a dated release
//     section and refreshes the compare links at the bottom.
//
//   node scripts/release.mjs notes <X.Y.Z> [en|es]
//     Prints that version's CHANGELOG section to stdout, so the GitHub
//     release body is the changelog rather than a dump of commit subjects.
//     With a language, prints that language alone (and fails if it has no
//     section for the version). With none, prints English followed by the
//     Spanish section when there is one.
//
// The changelog is kept in two files: CHANGELOG.md (English, the source of
// truth — a release cannot be cut without it) and CHANGELOG.es.md (Spanish).
// `bump` rolls both, so their version sections never drift apart.
//
// The four version files must never drift apart: Tauri stamps the .msi from
// tauri.conf.json, so a bump that misses it ships an installer labelled with
// the previous version.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
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

/**
 * Body of one `## [x]` section, minus the heading. The section ends at the next
 * heading or, for the oldest one in the file, at the block of compare links —
 * which would otherwise be printed as part of that version's notes.
 */
function section(changelog, heading) {
  const start = changelog.indexOf(`## [${heading}]`);
  if (start === -1) return null;
  const from = changelog.indexOf("\n", start) + 1;
  const rest = changelog.slice(from);
  const end = rest.search(/^(## \[|\[[^\]\n]+\]: )/m);
  return (end === -1 ? rest : rest.slice(0, end)).trim();
}

const CHANGELOG = "CHANGELOG.md";
const CHANGELOG_ES = "CHANGELOG.es.md";

/** The Spanish changelog, or null on a checkout from before it existed. */
function readSpanish() {
  return existsSync(join(root, CHANGELOG_ES)) ? read(CHANGELOG_ES) : null;
}

/** Surface a problem on the workflow run's summary page, not just in its log. */
function warn(msg) {
  console.error(process.env.GITHUB_ACTIONS ? `::warning::${msg}` : `release: warning: ${msg}`);
}

/**
 * Turn `path`'s [Unreleased] section into a dated one. `isFirst` is decided by
 * the caller from the English log, because that is the one that knows whether
 * an earlier tag exists: the Spanish log started later, and its first section
 * still has a previous version to compare against.
 */
function rollChangelog(path, version, previous, isFirst) {
  const src = read(path);
  const today = new Date().toISOString().slice(0, 10);

  // Leave an empty [Unreleased] behind for the next cycle.
  let out = src.replace(
    /## \[Unreleased\]\n/,
    `## [Unreleased]\n\n## [${version}] - ${today}\n`,
  );

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

  write(path, out);
}

function rollChangelogs(version, previous) {
  const src = read(CHANGELOG);
  const unreleased = section(src, "Unreleased");
  if (unreleased === null) die(`no [Unreleased] section in ${CHANGELOG}`);
  if (!unreleased) die("[Unreleased] is empty — nothing to release");

  // Was there a released version in the log before this one? If not, this
  // release opens the log, and there is no earlier tag to compare against —
  // link the release itself instead. A compare link against a tag that was
  // never pushed (or has since been deleted) is a 404 in the one file whose
  // job is to be a reliable index of what shipped.
  const isFirst = !/^## \[\d+\.\d+\.\d+\]/m.test(src);

  rollChangelog(CHANGELOG, version, previous, isFirst);

  // The Spanish notes ride along when they were written. Missing ones do not
  // block the release — a contributor who does not write Spanish must still be
  // able to ship a fix — but they are flagged, because the release page will
  // then carry English only and nothing else would say so.
  const es = readSpanish();
  if (es === null || section(es, "Unreleased") === null) {
    warn(`${CHANGELOG_ES} has no [Unreleased] section — v${version} ships with English notes only`);
  } else if (!section(es, "Unreleased")) {
    warn(`[Unreleased] in ${CHANGELOG_ES} is empty — v${version} ships with English notes only`);
  } else {
    rollChangelog(CHANGELOG_ES, version, previous, isFirst);
  }
}

// -----------------------------------------------------------------------------

const [mode, arg, lang] = process.argv.slice(2);

if (mode === "notes") {
  if (!arg || (lang && lang !== "en" && lang !== "es")) {
    die("usage: release.mjs notes <X.Y.Z> [en|es]");
  }
  const version = arg.replace(/^v/, "");
  const en = section(read(CHANGELOG), version);
  const spanish = readSpanish();
  const es = spanish === null ? null : section(spanish, version);

  if (lang === "es") {
    if (!es) die(`no ${CHANGELOG_ES} section for ${arg}`);
    process.stdout.write(`${es}\n`);
  } else {
    if (!en) die(`no CHANGELOG section for ${arg}`);
    process.stdout.write(`${en}\n`);
    if (!lang && es) process.stdout.write(`\n---\n\n## En español\n\n${es}\n`);
  }
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
  rollChangelogs(version, current);

  // Consumed by the workflow to name the commit, tag and release.
  console.log(version);
} else {
  die("usage: release.mjs <bump|notes> <arg>");
}
