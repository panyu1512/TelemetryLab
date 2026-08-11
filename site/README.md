# site/

The marketing page for TelemetryLab. Static HTML and three stylesheets — no
build step, no framework, no dependencies. Deploy the folder.

```
site/
├── index.html          the page
├── css/tokens.css      design tokens (see the caveat below)
├── css/site.css        the page's styles
├── css/footer.css      the footer, which has a device of its own
├── assets/*.png        product captures, generated — see capture.mjs
├── capture.mjs         regenerates assets/ from the live app
└── favicon.svg
```

## Running it locally

Any static server:

```bash
python3 -m http.server 4173 --directory site
# → http://localhost:4173
```

## Design

The page is a **third surface class** in this project's design system, alongside
the app and the overlays. The rules it inherits — and the five things it is
allowed that no app surface is — are written down in
[`design.md` § The marketing surface](../design.md).

The three that bite if you forget them:

- **`css/tokens.css` is a copy, not an import.** The site has no build step and
  cannot reach the app's Tailwind `@theme` block, so the colour values are
  duplicated. **Change a colour in `src/styles.css` and you must change it here
  too.**
- **The footer wordmark is tuned to the string "TelemetryLab" in Anton.** Its
  two knobs — `--brand-size` and `--brand-crop`, at the top of `css/footer.css`
  — are a measurement, not a preference: the size is 100 divided by the string's
  ink width in ems, the crop is half an x-height off the baseline. **Change the
  brand name or the display face and both have to be re-measured**, or the
  wordmark will either stop short of the edge or lose its last letter to the
  crop. The name itself appears twice in `index.html`, in two adjacent nodes —
  the `sr-only` copy and the visible one — and they must match.
- **Nothing on the page may be invented.** No metric, no download count, no
  testimonial, no logo wall. Every claim is either visible in a capture on the
  page or a plain fact about how the software runs. If you want to add a number,
  measure it first.

## Regenerating the captures

Every image is a real screenshot of the app on its built-in mock feed. When the
UI changes, re-shoot them:

```bash
npm run dev                                    # the app on :1420
npx -p playwright@latest node site/capture.mjs # in another terminal
```

Playwright is deliberately not a project dependency — the app doesn't need a
browser driver to build. `capture.mjs` documents why the shots use 2× scaling,
reduced motion, and a long wait on the fuel panel.
