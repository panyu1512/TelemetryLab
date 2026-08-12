# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/panyu1512/TelemetryLab/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/panyu1512/TelemetryLab/releases/tag/v1.0.0
