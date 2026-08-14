# Contributing to TelemetryLab

Issues and pull requests are welcome. This file is the long version; the
[README's Contributing section](README.md#contributing) has the commands.

**Open an issue before starting anything large.** Not as a formality — this app
has a written design system, and the most common reason a good patch gets sent
back is that it solved the problem in a way the surface it lands on had already
argued against. Ten minutes agreeing the shape first saves an afternoon.

## Getting it running

You do not need iRacing, or Windows, to work on almost any of this. The app
ships a mock feed that drives every overlay from synthetic telemetry:

```bash
npm install
npm run dev          # → http://localhost:1420
```

Then turn on **Global Settings → Mock Data**. A twelve-car, two-class field at
Spa appears, with lap times, sector splits, fuel burn and pit windows. There is
also a **Mock Session** switch there — Race, Qualifying or Practice — because
the timing screens read very differently in each, and that switch is the only
way to see the practice layout without a sim.

For the real bridge, and for building the Windows installer, see
[Quickstart](README.md#quickstart) in the README.

## The one thing to read first

[`design.md`](design.md) is the design system, and it is unusual in that it
records the *arguments* rather than just the rules — including the ones that
were reversed and why. Two sections govern most of what you will touch:

- **§ Dense tabular overlays** — Standings and Relative. Why there are no row
  separators, why column labels are off by default, why nothing on those
  screens can be clicked.
- **§ Two colour systems** — why class colour and status colour are kept apart,
  and why a row wears exactly one ground.

If your change contradicts something in there, that is allowed. Say so in the
PR, and update the file in the same change: a rule that no longer describes the
code is worse than no rule. Several of the entries in there are rewrites of
earlier ones for exactly that reason.

## What makes a change easy to accept

**Put the logic somewhere it can be tested without React.** The pattern
throughout is a pure module in `src/lib/` with the component as a thin shell —
`tableScale`, `classColors`, `sessionKind`, `fuelStrategy`. The test suite runs
in a `node` environment with no DOM on purpose, and it is fast because of it.

**Say what you did not verify.** Most of this project is developed against the
mock feed, so "not tried against real iRacing" is a normal line in a PR, not an
admission. It is far more useful than a checklist that implies more than it
covers.

**Screenshots for anything visual**, before and after if you changed something
that existed. Overlays are read at a glance; a diff does not show whether that
still works.

**Conventional Commits.** `fix(standings): …`, `feat(inputs): …`,
`docs(site): …`. The changelog and the release notes are written from them.

**A CHANGELOG line for anything user-visible**, under `## [Unreleased]`, written
for someone deciding whether to update — not for someone reading the diff.

## Quality gates

Both suites run on every PR and must be green.

```bash
npm run typecheck                    # tsc --noEmit, strict
npm test                             # vitest
npm run build

cd bridge
pip install -r requirements-dev.txt
pytest                               # coverage gate at 85%
ruff check . && ruff format --check .
```

New pure logic in `src/lib/` should come with tests and be added to the coverage
list in [`vitest.config.ts`](vitest.config.ts) — that list is deliberately
scoped to the logic that is actually unit-tested, so the number means something.

## Things that are deliberate, not oversights

Worth knowing before you file them as bugs:

- **The timing screens have no controls.** No buttons, no menus, nothing to
  aim at. They are read while your hands are busy; everything configurable
  lives in the Overlay Manager.
- **`readableInk` in `lib/contrast.ts` has no caller.** Kept and tested on
  purpose — see § Dense tabular overlays rule 11.
- **`private: true` stays in `package.json`.** This is a desktop app, not an npm
  package; the flag only stops an accidental `npm publish`.
- **Tyre temperatures may not move on track.** That is iRacing, not the app —
  `*tempCL/CM/CR` refresh in the pit stall for most cars. The widget says so
  when it detects it.

## Releases

Maintainer-only, and one button: run the `release` workflow from the Actions
tab with `patch` / `minor` / `major`. It bumps the five files that carry the
version, rolls `## [Unreleased]` into a dated section, tags, and dispatches the
Windows build. An empty `[Unreleased]` aborts it — there is nothing to ship.

## Licence

By contributing you agree that your contributions are licensed under the
[MIT Licence](LICENSE), the same as the rest of the project.
