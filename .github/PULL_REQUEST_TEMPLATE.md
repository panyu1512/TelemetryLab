## What this changes

<!-- The behaviour, not the diff. What is different for someone driving? -->

## Why

<!-- What was wrong, or what was missing. If it changes a decision recorded in
     design.md, say which one and why the old reasoning no longer holds — that
     file is meant to be argued with, not worked around. -->

## How you tested it

<!-- Be specific, and include what you could NOT check. "Not tried against real
     iRacing" is a normal and useful thing to write here: most of this project
     is developed against the mock feed, and knowing what is unverified is more
     useful than a clean-looking checklist. -->

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `cd bridge && pytest && ruff check .` *(if you touched the bridge)*
- [ ] Looked at it running — mock feed, real iRacing, or both

## Screenshots

<!-- Required for anything visual. Before and after if you changed something
     that already existed. -->

---

- Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`fix(standings): …`, `feat(inputs): …`) — the changelog and the release notes
  are written from them.
- User-visible changes get a line under `## [Unreleased]` in
  [`CHANGELOG.md`](../CHANGELOG.md), written for someone deciding whether to
  update rather than for someone reading the diff.
