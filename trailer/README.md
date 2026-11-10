# trailer/

The TelemetryLab trailer: forty seconds, 1920×1080, 30 fps, with a score. It
plays in the Trailer section of the site, in English and in Spanish.

It is a [HyperFrames](https://hyperframes.heygen.com) project — HTML and GSAP
timelines rendered to video one frame at a time — so the film is source code:
ten small HTML files, a script that records the footage from the live app, and
a script that writes the music.

```
trailer/
├── index.html             the edit: scene order, the copy in both languages,
│                          shared styles, the two audio stems
├── compositions/*.html    one scene per file
├── assets/footage/*.mp4   the app, recorded — see scripts/record-footage.mjs
├── assets/audio/*.m4a     music and effects — see scripts/score.py
├── assets/fonts/*.woff2   Inter and JetBrains Mono, the files the app bundles
├── scripts/
│   ├── record-footage.mjs shoots assets/footage/ from the app on :1420
│   ├── score.py           synthesises assets/audio/
│   └── encode-for-site.mjs  out/ → ../site/assets/
└── out/                   renders (ignored)
```

## The film

One idea, the site's h1: **read the field without looking.** The middle of the
film is one overtake told by three overlays — the gap on the Relative runs
down to nothing, the Radar lights, and the Standings move the player up a
place — then the two overlays you read after the corner, and finally all five
as separate windows, which is the product's whole idea.

| s | bars | scene | what happens |
| --- | --- | --- | --- |
| 0–4 | 1–2 | `hook` | The cluster, then the pedal traces, live. *Everything you would turn your head for.* |
| 4–8 | 3–4 | `cuts` | Six half-second cuts — two words and the real cell that answers them — then four four-frame flashes and half a second of paper. |
| 8–10 | 5 | `title` | *Read the field without looking.*, on the impact. |
| 10–14 | 6–7 | `relative` | The gap to the car ahead runs +0.4 → 0.0 s. Cuts on the frame before the rows swap. |
| 14–16 | 8 | `radar` | Dark for a beat, then the R lights. |
| 16–20 | 9–10 | `standings` | The camera is on rows 5 and 6 when, on the bar line at 18 s, the player's row glides up and takes its green ▲. |
| 20–23 | 11–12 | `coach` | A second in, the lap lands and the new-best banner becomes this lap's two tips. |
| 23–32 | 12–16 | `stage` | Fuel alone (a row lands in the per-lap table at 24 s); then it shrinks into its slot and the other four windows land around it, one a beat — the site's hero composite, assembled. At 28 s, the payoff. At 30 s a pointer drags the radar and resizes it. |
| 32–34 | 17 | `stats` | *Free. All of it.* over the site's stats strip. |
| 34–40 | 18–20 | `end` | The mark on the final hit, the name, the site's download button, held three seconds. |

The clock is the music's: 120 BPM at 30 fps is 15 frames a beat and 60 a bar,
so every scene starts on a whole frame that is also a beat, and the events
inside the footage — the pass, the radar lighting, the lap landing — are
placed on beats by choosing where each clip starts (`data-media-start`).

## Three rules

They are [`design.md` § The marketing surface](../design.md), rule 10, in
short:

- **Every picture of the product is the product.** The footage is the app on
  its mock feed, never a redrawn panel. The edit rearranges it and crops it;
  it does not paint on it.
- **Every line of copy is the site's.** The table at the top of `index.html`
  holds all of it, in both languages, and each line is a heading, a band or a
  label from `site/index.html` and `site/es/index.html`. Change the page's
  wording and change it there.
- **Nothing invented.** No number that is not on screen in the app or in the
  site's stats strip.

## Rebuilding it

Everything below runs from this folder. It needs Node, `ffmpeg`, and — only
for the step that uses them — Playwright, and Python with `numpy` and `scipy`.
None of those is a dependency of the app.

```bash
npm install            # hyperframes and gsap, for this folder only
npm run dev            # the HyperFrames studio: scrub, edit, preview
npm run check          # lint, layout, motion and audio gates
```

**The footage**, when an overlay in the film has changed:

```bash
(cd .. && npm run dev)                               # the app on :1420
npx -p playwright@latest node scripts/record-footage.mjs
FOOTAGE_ONLY=standings,radar node scripts/record-footage.mjs   # a subset
```

The recorder does not capture the screen in real time. It installs
Playwright's fake clock, advances it exactly 1/30 s per frame, steps every CSS
transition by the same amount, and screenshots — so there are no dropped
frames, and the same script shoots the same frames on every run. The mock feed
is a function of `Date.now()`, which is why the clip start times in the scenes
keep meaning what they mean after a re-shoot.

They stop meaning it if the mock itself changes (`src/lib/mockData.ts`). Each
scene's header comment names the event it is timed to; after a change there,
find the event's new frame and move that scene's `data-media-start`.

**The score**, when the edit's timing has changed:

```bash
pip install numpy scipy
npm run score          # → assets/audio/music.m4a, sfx.m4a
```

`score.py` is the whole soundtrack: oscillators, noise and filters, no samples.
Its section table and its effect times are the edit's, so a scene that moves
has to move there too.

**The render**, and the files the site serves:

```bash
npm run render         # → out/trailer-en.mp4
npm run render:es      # → out/trailer-es.mp4
npm run site           # → ../site/assets/trailer.mp4, trailer-es.mp4, trailer-poster.jpg
```

After `npm run site`: re-read the figcaption under the video in both pages if
the edit changed, and move `uploadDate` in each page's `VideoObject` block.

## What was and was not checked

- Every frame was looked at, as contact sheets and at full size across the
  cuts; `npm run check` passes with no errors or warnings.
- **The sound was measured, not heard.** It was written and mixed by a model
  with no ears: levels, spectrum per section, stereo correlation, loudness
  (about −14 LUFS integrated, true peak under −1 dBTP) and the position of
  every hit against its picture were all checked numerically. Whether it is
  *good* is a judgement nobody has made yet. If it is not, the music is one
  file — replace `assets/audio/music.m4a` with a 120 BPM track that has its
  drop at 10 s, and the cut still lands.
- Rendered with local Chrome, not HyperFrames' Docker mode, so a re-render on
  another machine can differ by sub-pixel text rasterisation.

## Licences

The composition, the scripts, the footage and both audio stems are this
repository's own, under its [MIT licence](../LICENSE). The two font files are
Inter and JetBrains Mono, both under the SIL Open Font License 1.1, copied
from the `@fontsource-variable` packages the app already depends on. GSAP and
HyperFrames are installed from npm and not vendored.
