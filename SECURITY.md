# Security

## Reporting a vulnerability

Please **do not open a public issue.** Use a
[private security advisory][advisory] instead — it is the one channel in this
repository that is not public, and it lets a fix be prepared before the problem
is described in the open.

Expect a reply within a week. If the report is valid you will be credited in
the release notes for the fix, unless you would rather not be.

[advisory]: https://github.com/panyu1512/TelemetryLab/security/advisories/new

## Which versions get fixes

The latest release. This is a single-maintainer hobby project and there are no
maintenance branches — a fix ships in the next version, and updating means
downloading the new installer.

## What the app actually exposes

Worth knowing before you go looking, and worth saying plainly rather than
implying more hardening than exists:

- **The bridge listens on `127.0.0.1:8765`** and serves telemetry over an
  unauthenticated WebSocket. That is deliberate: it is a local socket for a
  local overlay, and adding auth to a link between two processes on one machine
  would be ceremony. It also means **anything running on your machine can read
  your telemetry**, and that if you bind it to a wider interface — the README
  shows how, for running the UI on a second machine — you are putting your
  telemetry on that network in the clear. Do that on a LAN you trust.
- **The installer is not code-signed.** SmartScreen says so, loudly, and the
  site and README both say why. Every release publishes the installer's
  SHA-256, so the file you downloaded can be checked against the one that was
  built. Verifying that hash is a better guarantee than a signature you cannot
  inspect.
- **Nothing leaves the machine.** No telemetry, no analytics, no update check,
  no account. The only network requests the app makes are to `localhost`.

## What is out of scope

- The unauthenticated local WebSocket, per the above — unless you have found a
  way to reach it from off the machine in a default install.
- SmartScreen warnings on an unsigned installer.
- Anything requiring an attacker to already be running code on the machine.
