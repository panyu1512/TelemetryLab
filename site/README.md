# site/

The marketing page for TelemetryLab. Static HTML and two stylesheets — no build
step, no framework, no dependencies. Deploy the folder.

```
site/
├── index.html          the page
├── css/tokens.css      design tokens (see the caveat below)
├── css/site.css        the page's styles
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
the app and the overlays. The rules it inherits — and the four things it is
allowed that no app surface is — are written down in
[`design.md` § The marketing surface](../design.md).

The two that bite if you forget them:

- **`css/tokens.css` is a copy, not an import.** The site has no build step and
  cannot reach the app's Tailwind `@theme` block, so the colour values are
  duplicated. **Change a colour in `src/styles.css` and you must change it here
  too.**
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
