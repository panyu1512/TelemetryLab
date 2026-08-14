# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/panyu1512/TelemetryLab/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/panyu1512/TelemetryLab/compare/v1.1.2...v1.2.0
[1.1.2]: https://github.com/panyu1512/TelemetryLab/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/panyu1512/TelemetryLab/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/panyu1512/TelemetryLab/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/panyu1512/TelemetryLab/releases/tag/v1.0.0
