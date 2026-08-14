# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **TelemetryLab is open source, under the MIT licence.** A [`LICENSE`](LICENSE)
  file, so the code can actually be forked and contributed to rather than only
  read; [`CONTRIBUTING.md`](CONTRIBUTING.md), a code of conduct, a security
  policy, and issue and pull-request templates. The bug template asks two
  questions up front — does it still happen with mock data on, and what kind of
  session were you in — because between them they usually say whether a bug is
  in the overlay or in the data reaching it.
- The site has a **Source** section saying what the licence allows, that the
  whole interface builds and runs without a sim, and where the repository is.

## [1.7.0] - 2026-08-14

### Changed

- **Dashboard widgets lost their name and icon.** Every card was headed by one
  or the other; neither was doing much. A label you have already learned costs
  a glance every time you skip it, and these are read in peripheral vision at
  speed — a speed gauge does not need the word "speed" on it, and the layout
  was already hiding those names the moment a card got short or narrow. The
  card is content edge to edge now, in the dashboard, in a popped-out widget
  window and in the Manager's preview. Grab anywhere on a widget to move it;
  its actions sit in the top-right corner and appear on hover.
- **A class band carries its colour across the whole row.** It used to sit on a
  plain white wash with the rows' clipped fill laid over its first column, which
  read as a row that happened to be lighter rather than as the thing opening the
  group. The band is the heading and the rows are what it heads, so it takes the
  colour at full width and a step stronger: masthead solid, rows striped.

## [1.6.0] - 2026-08-14

### Changed

- **Class colours are the app's own now, and never red.** They came from
  iRacing, which hands out whatever hue it likes — its stock GT3 colour is
  `#ff4d4d` — while this app spends red on lapped traffic. A red-edged row
  beside a red-grounded row was two unrelated things in one colour, and at four
  or five classes some class landing on red, on the blue that means "this is
  you", or on the amber that means "pit" was a matter of time. The five class
  colours are now picked against every status hue in all four themes, each
  clearing its nearest by at least 25°, with consecutive classes more than 100°
  apart so neighbouring groups can never blur together.
- **A class now colours its rows, not just their leading edge.** Three pixels
  asks the eye to find a hairline before it can tell one group from another.
  On **Standings** the class colour runs in from the left edge and stops at the
  end of the first column, at 12 % — its rows come in runs of the same class, so
  the fills line up into a bar of colour down the leading edge of each group.
  The stop is taken from the column model rather than being a share of the row,
  so it lands on the column boundary whichever columns are switched on and
  however far the table has scaled. On the **Relative** it stays a full-row wash
  at 14 %, because that table is sorted by where cars physically are, so
  same-class rows rarely sit together and there is no run to build a bar from.
- **The class band joins its group.** It now carries the same leading edge and
  the same fill, stopping at the same place, so the band and every row beneath
  it line up into one unbroken bar of class colour. Its edge was a flat 3 px
  while the rows compensated for the table scale, which quietly put the two on
  different verticals at anything below full size. The class name is no longer
  a filled pill — the pill sat exactly where the fill goes — and is set in the
  class colour instead, sitting on the fill the way a row's leading number sits
  on its own, and starting at the same inset so the band's content begins
  exactly where the field's does. A row still wears
  exactly one ground: where "this is you" or "not on your lap" applies, the
  class colour gives way entirely and the leading edge carries class alone.

## [1.5.0] - 2026-08-14

### Added

- **A clutch bar in the Inputs widget**, beside throttle and brake. It shows
  pedal travel — empty with your foot off, full with the pedal down — which is
  the opposite of what iRacing publishes: the sim's `Clutch` channel runs
  "0 = disengaged, 1 = fully engaged", so a bar drawn straight from it would
  sit full whenever the clutch was *not* being used. The bridge sends both the
  raw channel and the travel, and the flip happens once, next to the read.
- **A steering wheel that turns with your hands**, in place of the linear
  deflection bar. It is the same shape as the thing it reports, so a glance
  lands as a position rather than as a measurement — and unlike the bar, which
  pinned at ±120°, it keeps turning, so a big catch of oversteer or a hairpin's
  worth of lock reads as movement instead of as a full bar holding still. It
  sits to the right of the pedals as a fourth input column, in the same
  value/body/label grammar the bars use, which also hands the trace back the
  height the old full-width steering strip was taking from it.

## [1.4.0] - 2026-08-14

### Changed

- **Standings and Relative scale to fit instead of dropping columns.** Making
  either overlay smaller used to shed columns one by one — sectors first, then
  position change, tyre, licence, iRating and on down a list — so the type
  could stay full size. It meant resizing the window silently changed *what the
  table showed*, with nothing on screen to distinguish a dropped column from
  data that never arrived. Both surfaces now shrink whole: one factor scales
  the type, rows, gaps, column widths and the session strip together, so every
  column you asked for is there at every size and the layout tuned at full size
  is the same layout at half. The table stops shrinking at half scale, below
  which it scrolls sideways as before.
- The 3 px class-colour edge on each row holds its drawn size as the table
  scales. It went to 3 px to stop vanishing in peripheral vision, and scaling
  it with everything else would take it back under the 2 px already rejected.

## [1.3.0] - 2026-08-14

### Changed

- **Standings is a timesheet in practice and qualifying, not a running order.**
  It ranked by iRacing's race position and showed gap to leader and interval
  alongside it — numbers measured against a race nobody in a test session is
  running. Outside a race the table now ranks by best lap, prints that ranking
  in the position column, and drops the three columns that describe a race:
  gap, interval and positions gained. Best and last lap are what is left,
  which is what the session is about.
- **The Relative stops calling neighbours lapped traffic outside a race.**
  Being a lap down is a race warning — it means a position is changing hands.
  In practice, drivers join when they like and run their own programmes, so lap
  numbers differ across the field by design: every row was taking a `-1L` tag
  over a red ground, which is the whole table shouting and therefore the whole
  table silent. The gap to the car ahead and behind is now all it says, which
  is the number that still means something when you are on a lap.

### Added

- **A Mock Session setting** (Global Settings, under Mock Data) switching the
  mock feed between Race, Qualifying and Practice. The timing screens read very
  differently in each, and this is the only way to see the practice layout
  without a running sim.

## [1.2.0] - 2026-08-14

### Fixed

- **The tyre temperatures update as you drive now.** The corners were arriving
  every frame all along — the readout just rounded them to a whole degree, and
  carcass temperature has enough thermal mass behind it that whole degrees can
  sit unchanged for a minute at a time. Next to the speed and the pedal traces
  the widget looked dead. It reads to a tenth now, which is the resolution the
  quantity actually moves at.
- **Tyre pressures are no longer permanently "—".** The bridge asked the SDK
  for `LFpress`, which is not an iRacing variable: every read raised and fell
  through to `None`, so no pressure ever reached the overlay. It reads
  `LFcoldPressure` now — the only per-corner pressure the live API exposes —
  and the widget labels it `cold`, because it is the garage figure and holds
  for the stint rather than tracking the tyre.

### Added

- **The tyre widget says when it is showing you your last stop's numbers.**
  `*tempCL/CM/CR` are the only per-corner temperatures in iRacing's live shared
  memory, and for cars without real-life live telemetry the sim refreshes them
  in the pit stall rather than per frame — the channel keeps delivering at
  60 Hz, carrying the same numbers each time, so a held readout and a live one
  are identical to look at. What separates them is time, so the widget now
  times how long each corner has carried the same values: a corner that has not
  moved in fifteen seconds fades, and when all four have, a strip under them
  reads `since last stop` with how long it has been.

### Changed

- The mock feed holds cold pressure static per corner instead of animating it,
  so the mock promises exactly what the real bridge can deliver.

## [1.1.2] - 2026-08-13

### Fixed

- **The car-brand marks are readable in the row now.** They were too small to
  identify at a glance, and the size was mostly an illusion: each mark carried
  its source file's padding, so most of the box was empty space — McLaren's
  speedmark was 15% of its box and Audi's rings 35%, which left two or three
  pixels of actual drawing. Every mark is now cropped to its own ink and drawn
  at 24 px in pure white, with the car column widened to hold it, on both the
  standings and the relative.
- Makes without a badge show their first three letters at a readable size
  rather than in a faint grey.

### Changed

- **The mock field is a multi-make grid.** It used to be six Audis racing six
  McLarens, which made the car column a column of identical badges — the one
  thing that column exists to prevent. It now runs a plausible GT3 and GT4
  field, so the demo, the previews and the site's captures show what a real
  grid looks like.

## [1.1.1] - 2026-08-13

### Fixed

- **The car-brand marks in the standings are the real logos now.** They had
  been drawn by hand, and several were not the manufacturer's badge at all:
  Chevrolet's bowtie was two arrowheads facing each other, Cadillac's crest an
  undivided hexagon, RAM's head a stroke over a triangle. Twenty-one marks —
  Toyota, Honda, Lamborghini, McLaren, Porsche, Ford, BMW, Ferrari, Audi,
  Chevrolet, Cadillac, Acura, Mazda, Nissan, Hyundai, Subaru, Volkswagen,
  Aston Martin, Kia, RAM and Renault — now use the manufacturer's own vector
  art, and Dallara its wordmark. They still take the row's ink on any
  background, exactly as before.
- **Eleven makes show their name instead of a badge.** Lotus, Radical, Skip
  Barber, Buick, Holden, HPD, Ligier, Ray, Riley, Ruf and Williams have no
  authoritative single-colour logo to draw from, and a mark that identifies
  the wrong car is worse than no mark: those rows now carry the first three
  letters of the make until real art exists for them.

## [1.1.0] - 2026-08-12

### Added

- **A `.exe` installer, and it does not ask for administrator rights.** The
  Windows build now produces an NSIS `-setup.exe` alongside the `.msi`, and it
  is the one you want: it installs into your own user profile, so there is no
  UAC prompt and no Windows Installer wizard to click through, and it opens
  the app when it finishes. The `.msi` remains for per-machine and managed
  deployment.

### Changed

- **The download link downloads.** It used to open the release page and leave
  you to find the file. Each release now publishes a copy of the installer
  under a fixed name, `TelemetryLab-setup.exe`, so the site can link straight
  at the newest one — the versioned files beside it carry the version in their
  names and therefore cannot be linked to permanently. The stable copy is
  listed in `SHA256SUMS.txt` under its own name, so a direct download is still
  verifiable.

### Fixed

- The site described the installer as a `.msi` after the `.exe` became the
  recommended download, and never said what installing actually does to the
  machine. It now says both.
- Links inside running prose used a control sized for standalone tapping —
  44 px tall with its own padding — which opened a gap before the punctuation
  that followed and inflated the line box around it.

## [1.0.0] - 2026-08-12

### Added

- **Standings.** The whole field, grouped by class. Each class opens with a
  band carrying its car count, strength of field and the lap that leads it,
  and every row carries gap to the class leader, interval to the car directly
  ahead, last and best lap, sector deltas, iRating with a live projected
  change, licence and safety rating, tyre compound, and pit and off-track
  state. Fifteen columns, all but three of them yours to switch off; the rest
  drop out right-to-left as the window narrows rather than growing a
  scrollbar.
- **Relative.** Sorted by time on track rather than by position, so it shows
  the cars you are about to meet whatever lap they are on. Gaps are signed and
  live, lapped traffic is distinguished from same-lap rivals, and a closing
  indicator fires when a faster car is catching you.
- **Fuel & strategy.** Works from your own measured burn rather than a number
  typed in before the race: consumption per lap, laps of fuel remaining, a pit
  window and a recommended lap recomputed every lap, a fuel-save target when
  finishing on what is in the tank is close, and candidate one- and two-stop
  plans. The safety margin is a lap count in iRacing's own units, defaulting
  to 1.0 lap, and a timed race's length comes from the leader's pace rather
  than yours.
- **Driving cluster.** Speed, RPM with a shift light, gear, a throttle and
  brake trace, steering, per-corner tyre temperatures and pressures, lap
  timing with a delta against your best, and position.
- **Overlay Manager.** Every overlay is its own always-on-top window — place,
  size and theme each one independently, against a live preview of the overlay
  being configured. Four themes, and a mock-data mode that runs the entire
  interface on synthetic telemetry with no sim running.
- **The timing screens carry no controls.** Nothing on them can be aimed at,
  because while you are reading them your hands are busy. Everything
  configurable lives in the Manager.
- **Windows installer.** A `.msi` built by CI from a tagged commit, published
  with a SHA-256 so the download can be verified. It is not code-signed, so
  Windows SmartScreen will warn on first run — see the README.

[Unreleased]: https://github.com/panyu1512/TelemetryLab/compare/v1.7.0...HEAD
[1.7.0]: https://github.com/panyu1512/TelemetryLab/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/panyu1512/TelemetryLab/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/panyu1512/TelemetryLab/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/panyu1512/TelemetryLab/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/panyu1512/TelemetryLab/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/panyu1512/TelemetryLab/compare/v1.1.2...v1.2.0
[1.1.2]: https://github.com/panyu1512/TelemetryLab/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/panyu1512/TelemetryLab/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/panyu1512/TelemetryLab/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/panyu1512/TelemetryLab/releases/tag/v1.0.0
