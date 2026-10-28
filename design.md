# Design — TelemetryLab

A locked design system for this app. Every surface redesign reads this file
before emitting code. Do not regenerate it per screen — extend or amend it when
the system needs to grow.

Because this is one product rather than a set of pages, the usual "make each
page different" rule is **inverted**: surfaces must share the system. Variety
lives in what each surface *does*, not in its palette or its type.

## Genre

**modern-minimal** — the technical, instrument-panel end of it, in the voice of
race-engineering software (§ Race-engineer telemetry). Dark by necessity:
overlays are composited over live game footage, and the manager sits on a
second monitor at night.

## Race-engineer telemetry

**The direction since 1.25.** The app reads like motorsport data-analysis
software and a pit-wall screen: technical, dense, precise. An engineering tool,
not a marketing dashboard. It replaced the "pit wall — hard edges, solid
blocks, 13.5° shear" look of 1.8–1.24, and the sections below were rewritten
with it; where an older argument survives in this file it is because the new
direction kept its conclusion.

Six rules carry it. The rest of this file is how each one lands on a surface.

1. **Near-monochrome, one accent.** Graphite with a blue-black cast — never
   pure black — at three surface levels a few points apart, drawn by 1 px
   hairlines. Data is light grey, labels mid grey, nothing pure white.
   **One accent**, a muted cyan (`--color-primary`), marks focus, selection,
   the active thing and "this is you". Every other colour is **semantic and
   only where it means something**: green gain/best, red loss/worst, yellow
   warning, purple the session-best lap (the timing convention), the sim's own
   blues for lapped traffic and wet tyres. No decorative colour, no gradient
   fills, no coloured shadows, no glass, no coloured backgrounds — a status
   that used to tint a block now marks it with a 2 px bar and its own ink.
2. **Words in Inter, numbers in mono.** Every figure is set in JetBrains Mono
   with tabular, slashed-zero figures (`.tnum`), so a value never jitters as it
   updates. Labels are sans, small, uppercase, tracked (`label-caps`,
   `.wg-label`). A unit sits a size smaller and a step dimmer than its value
   (`unit`, `.wg-unit`) — `287 KM/H` is one number with its unit attached.
   Hierarchy is size and weight, not colour.
3. **Rectangular panels, 1 px dividers.** 2–3 px radii (`--radius-ctl`,
   `--radius-card`, `--radius-panel`), a 1 px edge, no floating cards and no
   shadows except under a dragged or floating layer. Panels carry a thin
   header (`PanelHeader`, `.panel-header`): the channel name on the left, its
   value or actions on the right. Rows on the dense tables are divided by a
   hairline (`.timing-row-rule`).
4. **Charts are instruments.** 1–1.5 px lines (`--chart-line`), no fill, a
   faint dotted grid, hairline axes. A reduced palette: the primary channel in
   the accent, secondary channels in neutrals (`--color-chart-secondary`,
   `--color-chart-tertiary`), a reference lap in grey
   (`--color-chart-reference`). Live charts have no entry animation; the input
   trace's cursor is "now", at its right edge.
5. **Effects stay, restrained.** Every animation the app had is still there,
   shortened to 120–200 ms on `--ease-out`, with no overshoot and no glow.
   Hover steps an edge or a ground one tone. Live states are a small dot with
   a slow, shallow pulse (`.live-dot`) — it breathes, it never blinks.
6. **Class colour is the one functional exception, and only in multiclass.**
   Five desaturated hues (`--color-class-1…5`, `--class-1…5`), spaced against
   the accent and every semantic colour (§ Two colour systems, rule 1). They
   appear as a 3 px bar down a row's left edge and its class band's, as a
   small tag beside the car number on Relative, and as a line colour when a
   chart compares cars of different classes — never as a row's ground, a
   panel's background or a block of text. **A single-class session shows no
   class colour at all**: the bar keeps its width and draws in nothing.

Everything is a token. Colours, chart tones, the type scale (`--text-label`
… `--text-readout-lg`), tracking, radii and durations are declared once in
`@theme` in [`src/styles.css`](src/styles.css); the fluid widget sizes are the
`.wg-*` roles there; [`tokens.css`](tokens.css) and
[`site/css/tokens.css`](site/css/tokens.css) mirror them.


## Audience and use case

Sim racers, mid-session. The Overlay Manager is nominally a pre-race surface,
but it gets opened alt-tabbed or on a second screen between stints. The design
target is therefore: **state readable without reading**, primary action always
reachable, nothing that costs the user a corner.

Tone: **technical**. Instrument nomenclature, hairline rules, dense data, no
decoration.

## Macrostructure family

- **App surfaces: Workbench.** A left rail of subjects, a fixed-width control
  column, and a live preview taking the remaining space. The preview is the
  frame; the config column is its annotation. Variation knob: whether the
  preview pane exists (the Manager has it; Global Settings and Debug do not,
  and centre a single `max-w-3xl` column instead).
- **Overlay surfaces: none.** An overlay is a single widget card with a body
  and, where it earns its place, a header rule. It has no macrostructure and
  must never acquire one. **Tabular overlays** — Standings and Relative — are a
  named exception to the header rule; see § Dense tabular overlays.
- **Marketing surface: product landing.** One page, at [`site/`](site/), in
  English and Spanish, selling the app: a centred hero over a composed stage
  of real captures, then overlay cards, features, install steps, price, FAQ.
  Every card still pairs a claim with the capture that proves it. See § The
  marketing surface.

## Theme

Custom (tuned), in OKLCH so a token can be lifted to hit a contrast target
without dragging its hue. Values in [`tokens.css`](tokens.css); the live source
is the `@theme` block in [`src/styles.css`](src/styles.css).

Four runtime themes (Carbon, Midnight, Graphite, Endurance) vary the
temperature of the neutrals and the exact tone of the accent. **They never
vary what a colour means, and never the accent's family**: it is a cool cyan
(hue 222–234) in all four, so the class palette can be spaced against one
reserved band rather than four. Endurance gave up its copper accent for this
in 1.25 — a copper "interactive" sat between `danger` and `warning`, exactly
where the class ramp needs its orange.

The neutrals are graphite with a blue-black cast, three surface levels a few
points apart (`bg` 17.5 %, `surface` 20.5 %, `surface-2` 23.5 % in Carbon),
and two hairline tones. `--color-timing-bg`, the overlay panels' paper, is
`bg` taken 14 % toward black: the darkest graphite in the palette, and never
pure black. Ink is light grey (`text` 91 %), mid grey (`muted` 72 %) and a
tertiary grey (`faint` 60 %, the floor that clears 4.5:1 on `surface`).

| Token | Meaning | Never used for |
| --- | --- | --- |
| `--color-primary` | **the one accent**: focus, selection, the active thing, **the player's own row**, a chart's primary channel | status, decoration |
| `--color-accent` | gain: personal best, faster, healthy | chrome, decoration, interaction |
| `--color-danger` | loss / critical: slower, overheating, out of fuel, a car alongside | destructive-button chrome at rest |
| `--color-warning` | caution: pit soon, yellow flag, worn tyres | interactive affordances |
| `--color-sector-purple` | overall-best lap/sector | anything else |
| `--color-lapped` | Relative ink for a car a lap or more behind you — the sim's blue flag. Fixed, not themed | grounds, fills, anything but that ink |
| `--color-tyre-wet` | a wet tyre: the ring and `W` of the compound badge. Fixed, not themed | anything but that badge |
| `--color-class-1…5` | car class, multiclass sessions only (§ Two colour systems) | grounds, backgrounds, text |
| `--color-chart-*` | chart channels in neutrals, the reference lap, grid, axis, bar track | status |

The token *names* are the earlier system's — `accent` still means positive and
`primary` still means interactive — so every call site kept its meaning when
the values moved.

Three rules that fall out of that table and are easy to break:

1. **`--color-on-accent` is the only text colour allowed on a filled status
   surface.** Every accent in this system is light and every paper dark, so
   white on a fill measures near 2.5:1. `on-accent` reads 6–12:1.
2. **A theme's `primary` must stay ≥30° in hue from its `warning`.** Endurance
   once shipped them 8° apart, which made "you can click this" and "caution"
   the same colour.
3. **A theme's `primary` stays in the cyan band, 222–234.** The class ramp is
   tested against every theme's accent; an accent that wanders takes a class
   colour's room with it.

## Two colour systems

The table above governs **status** — what the app has computed about a value.
There is a second, unrelated axis on the timing surfaces: **identity** — which
class a car is in, and which car is yours. Conflating the two is how a
standings table stops being readable at a glance.

1. **Identity colour is ours, chosen against the status hues.** It used to be
   `carClassColor`, taken from iRacing as given. That produced the collision
   it was meant to avoid: the sim's stock GT3 colour is `#ff4d4d`, this app
   spends red on loss, and at four or five classes some class landing on red,
   on the cyan that means "this is you", on lapped blue or on the yellow that
   means "pit" stops being a risk and becomes an expectation.

   So the five class colours come from
   [`lib/classColors.ts`](src/lib/classColors.ts) — teal, orange, violet,
   lime, pink, a step desaturated (OKLCH chroma 0.10–0.12) for the graphite
   ground — spaced against every status hue in all four themes: `danger` 22,
   `warning` 90, `accent` 152, `primary` 222–234, and the fixed `lapped` blue
   at 245 (a test reads it from `styles.css`). Every entry clears its nearest
   reserved hue by more than 25°, and consecutive entries — which colour
   consecutive class groups down the screen — sit more than 100° apart. The
   same five values are the `--color-class-1…5` tokens; a test holds the two
   together.

   `carClassColor` is still on the wire and still unused for display. Do not
   add it to `tokens.css`, and do not let a theme try to correct it.
2. **Identity colour is a bar, a tag and a line — never a ground.** Class has
   three carriers:

   - **the bar**, 3 px down a row's left edge (`CLASS_EDGE_WIDTH`, held at its
     drawn size as the table scales) — drawn once per run of same-class rows
     (`LayoutRun` in
     [`useStandingsLayout.ts`](src/components/standings/useStandingsLayout.ts),
     `ClassRun` on Relative), so it has no join per car to seam at — and the
     same bar on a class band;
   - **the tag** on Relative, which mixes classes row by row: the class's
     short name, small and grey, opened by a 2 px bar in its colour
     (`.class-tag`), beside the car number it qualifies — the way a car is
     called on the radio, number then class. Standings needs none: its rows
     sit under a band that names the class;
   - **a chart line**, when a chart compares cars of different classes.

   **Nothing else is class-coloured.** Through 1.24 the colour ran on from
   the edge as a gradient fill behind the position, and the class's name was
   lettered in its colour with a black outline under the glyphs. Both are
   gone: a fill behind the first number on every row, and a column of names
   in three hues, are the decorative colour this direction removes. Driver
   names, positions and class names are neutral ink.

   **A single-class session shows no class colour at all.** Class is
   information only when there is more than one; the bar keeps its width, so
   nothing moves, and draws in nothing, and the band's bar falls back to the
   neutral hairline tone.

   Nothing drives an identity carrier's extent per row, and nothing should:
   everything on these surfaces that could moves at 10 Hz.
3. **"This is you" is the accent, and it is the row's ground, not its ink.**
   `bg-primary/[0.13]` plus an inset `primary/55` ring, on both surfaces
   (`PLAYER_ROW_GROUND`): selection is what the one accent is for. **It is the
   only marked row**: lapped traffic is blue *ink* (§ Dense tabular overlays,
   rule 14), and no row has a class ground, so the ground and ring stay an
   answer to "which one is me" and nothing else. The ring keeps it findable in
   Graphite, whose accent is close to neutral. Tinting the *text* instead
   would put an identity colour and a status colour in the same glyph.

The obvious alternative — amber for your own car, as several timing overlays do
it — is banned here for the reason rule 2 of § Theme already gives: our
`warning` is yellow. "That's you" and "pit soon" would be the same colour. It is
also why the one accent is cyan rather than the amber a pit-wall screen often
uses.

## Typography

- **Words: Inter** (`--font-sans`), on every surface, overlays included
  (`--font-timing` names the same face for the surfaces that paint on the
  overlay paper, so a future split costs one line). Weights 400–600 for
  text; 600 is the heaviest anything on an overlay is set — on
  `.timing-surface` the normal / medium / semibold / bold utilities resolve
  to 450 / 500 / 600 / 600, so a value is never heavier than it needs to be
  and a name never lighter than it can be read over footage.
- **Numbers: JetBrains Mono** (`--font-mono`), bundled
  (`@fontsource-variable/jetbrains-mono`), never fetched — the overlays run
  offline. **`.tnum` is the contract**: it sets the mono, tabular figures and
  a slashed zero, so every figure on every surface is the same voice and a
  column of lap times lines up digit for digit. A value that forgets `.tnum`
  is visibly in the wrong face.

  This replaces Saira (1.15–1.24), a squared motorsport face set bold across
  every overlay. It read as broadcast graphics; the race-engineer direction
  wants the voice of analysis software, where the words are a plain grotesk
  and the data is monospaced. Saira's three tests — true tabular figures,
  an x-height near Inter's, a variable weight axis — are all met by the pair
  that replaced it, the first one better: a mono's figures are tabular by
  construction.
- **Labels are sans, small, uppercase, tracked** — `label-caps` (9 px, 600,
  `--tracking-label` 0.12em, `muted`), and `.wg-label` for the fluid widget
  size. One voice for every channel label on every surface; the column labels
  are the same at 8 px (`--text-colhead`), the only size the 10 px label
  slice allows. They used to be mono; mono is now the figures' alone, so a
  label and its value never share a face.
- **A unit is smaller and dimmer than its value** — `unit` (0.72em, `faint`,
  caps) and `.wg-unit`: `287` large, `KM/H` small.
- **Hierarchy is size and weight, not colour.** The type scale is by role,
  declared as tokens: `--text-label` 9 · `--text-micro` 10 · `--text-small`
  11 · `--text-cell` 12 · `--text-name` 13 · `--text-emph` 14 · `--text-title`
  15 · `--text-readout` 16 · `--text-readout-lg` 18. No component sets an
  arbitrary pixel size.
- Prose — descriptions, hints, help text — is always sans, mixed case.
- **Headings are roman.** No italic display type anywhere.
- **Caps are structural, not emphatic.** Labels, section and page headings — a
  class band's class name is one — and CTAs (§ CTA voice) are set in capitals,
  and nothing else is. **Driver names are title case**, on both timing
  surfaces, through one helper ([`lib/driverName.ts`](src/lib/driverName.ts)):
  normalising the member's own casing (`JOHN SMITH` → `John Smith`,
  `O'BRIEN` → `O'Brien`) keeps one voice down the only ragged column without
  the width and the lost silhouette caps cost, and leaves deliberate casing
  alone (`McDonald`, `van Berg`).

## Spacing

Tailwind's default 4-point scale. Named equivalents are exported in
`tokens.css` for portability; the app uses the utilities.

## Motion

- Easings: `--ease-out` `cubic-bezier(0.2, 0.7, 0.2, 1)`, plus `--ease-in` and
  `--ease-in-out`. These override Tailwind's transition defaults, so a bare
  `transition-colors` inherits the curve without restating it. The earlier
  `--ease-out` (`0.16, 1, 0.3, 1`) decelerated so long it read as a settle;
  this one is done when it looks done.
- Durations: `--dur-instant` 80 ms, `--dur-short` 120 ms, `--dur-mid` 180 ms,
  `--dur-long` 200 ms. **Nothing on UI state runs longer than 200 ms**; the
  row glide, the position flash and every hover live inside that.
- Animate `transform` and `opacity` only. Never layout properties.
- No overshoot, no bounce, no glow. Travel is a few pixels (the position
  flash's arrow 3 px, a qualifying arrival 10 px), never a leap.
- **Live states breathe, they do not blink**: `.live-dot`, a 6 px dot whose
  opacity eases between 1 and 0.45 over 2.4 s. The rev strip at the limiter
  pulses (`.redline-pulse`), shallow and quick, as the one alarm the cluster
  has.
- Reveal pattern: **none on any app surface.** The manager fades in once on
  mount (`manager-in`); nothing in the app animates on scroll. The marketing
  page is the single exception, fenced in § The marketing surface rule 6.
- Reduced motion: spatial movement collapses to ≤150 ms opacity; the two short
  durations go to 0.
- **The focus ring is never transitioned.** It appears on the frame the key
  lands.

## Microinteractions stance

- Silent success. No celebratory toasts — the panel shows the result.
- Optimistic change; the control *is* the confirmation.
- Hover tooltips delay 800 ms; focus tooltips 0 ms.
- Hover affordances always have a focus equivalent.

## Component contract

Every interactive element in [`src/components/ui/controls.tsx`](src/components/ui/controls.tsx)
ships all eight states: default · hover · `:focus-visible` · active · disabled ·
loading · error · success. Three invariants:

1. **`border-width` never changes between states.** State goes to background,
   outline or colour — never to geometry.
2. **The focus ring is an `outline` at 2 px offset**, so it lands on the page
   rather than the control's own fill and stays visible on a filled button.
3. **Pointer targets are expanded past the painted box** with an inset
   pseudo-element, so the panel stays dense without becoming fiddly.

Text inputs additionally reserve a right-edge slot for the spinner/status glyph
and a stable one-line helper row, so neither appearing reflows the panel.

## CTA voice

- Primary: `bg-primary` fill + `text-on-accent`, `--radius-ctl` (2 px), label
  is a verb phrase, always `whitespace-nowrap`.
- Secondary: `bg-surface-2` + 1 px `--color-border`, same geometry.
- Destructive: secondary geometry; `danger` arrives only on hover, never at
  rest.
- **Every variant is a square-cornered rectangle set in caps** — 11 px
  (`--text-small`), semibold, `--tracking-caps`. Caps carry no descenders and
  read a size larger than they measure, so the label keeps the row's height.
  CTAs were cut on the old mark's 13.5° shear through 1.24; see § The mark
  rule 5 for why the cut stopped at the mark.
- Switches keep their pill track — the one control whose *shape* is its
  affordance; squared, a knob sliding in a rectangle reads as a progress bar —
  with a flat knob and no shadow.

## The mark

A **TL monogram**: a white T over a teal L, leaning 19° forward, with the
crossbar's right end and the L's foot cut at 45°. It is the only drawn symbol
in the system — everything else on every surface is type, rule or data.

It replaced the single-colour, 13.5°-sheared monogram of 1.8–1.27 with the
artwork the project now uses everywhere. The geometry is a regularised trace of
that artwork, written out in the header of
[`public/favicon.svg`](public/favicon.svg) so it can be rebuilt rather than
re-traced: the T's stem and the L's upright are parallel at 0.341 x per unit of
height and share one stroke; the crossbar's left end is cut at 35°; the L's top
sits just under the crossbar so the two letters share a baseline and read as one
block. The ink is 24 wide and centred on a 32 grid.

Five rules:

1. **Two colours, fixed roles.** The T is ink and the L is the brand teal
   (`--color-brand`, `#0dd2cb`). On the icon plate the T is white
   (`#f4f7f9`); on chrome, the nav and the title bar it takes `text`, so on the
   site's light paper it goes dark rather than vanishing, and the L takes a
   darker teal there (`oklch(56% 0.1 189)`). The teal is the logo's colour and
   nothing else: it is **not** an accent, carries no meaning in the status
   table, and never appears on data or controls. It is close to `primary`'s hue
   on purpose but is not `primary` — the mark does not change when a theme
   moves the accent.
2. **The plate is for icons only.** A 7-radius square of the timing surfaces'
   near-black (`#0a0d12`), because an OS icon has to bring its own ground. In
   the nav and the title bar the mark is bare — those surfaces have paper
   already.
3. **The ink fills 52 % of the box's height**, so the box is sized to set the
   letters about a fifth taller than the cap height they sit beside — 1.75em
   against the site's wordmark, 22 px against the title bar's 13 px name.
4. **It is always `aria-hidden`.** The product name is next to it in every
   place it appears.
5. **The lean is the mark's, and stops there.** From 1.8 to 1.24 the old
   mark's 13.5° cut was a system device on the app's chrome — the title bar's
   status readout, the profile chip, the section legends, every CTA — while the
   instruments stayed square, on the argument that a driver reading a lap time
   needs the column edges vertical. The race-engineer direction extends that
   argument to the frame: an engineering tool is one instrument, and its
   controls are as square as its data. `--shear` and `.shear` are gone; the
   section legend is a 2 px accent bar (`.section-block`), and chips and CTAs
   are rectangles. The new mark's 19° does not bring any of it back.

`public/favicon.svg` is the source. The platform icons in `src-tauri/icons` are
generated from it with `npm run tauri icon public/favicon.svg` (the Android,
iOS and Store sets it also emits are dropped — the app ships an msi only);
`site/favicon.svg` is a copy for the same reason the site's tokens are one; and
the site's nav and footer (both languages) and the app's title bar inline the
two paths so they can follow the theme. **One geometry everywhere** — change
the mark and change every copy.

## What every surface MUST share

- The token names (not the values — those move per theme).
- The colour *meanings* in the table above, and the one accent.
- Inter for words, JetBrains Mono for every figure (`.tnum`), sans caps for
  every label.
- The mark, and the rules under § The mark.
- The control contract and the 8 states.
- 2–3 px radii — 2 on controls, 3 on cards and panels — and 1 px edges.
- The motion tokens: nothing on UI state over 200 ms, no bounce, no glow.

## What surfaces MAY differ on

- Presence of the preview pane (Workbench with or without it).
- Density — an overlay over game footage is tighter than the manager.
- Which status colours appear at all; most surfaces use none.

## Per-surface allowances

- **Manager chrome** speaks the instrument voice: sans-caps channel labels,
  the `.section-block` accent bar before each section heading, the
  three-state sidebar rail, and live dots that breathe.
- **Overlay widgets** are legibility-first over footage: `.timing-surface`
  paper (§ Dense tabular overlays rule 9), a tight neutral text-shadow, no
  scrollbars. Each is a panel with a thin header naming its channel
  (`PanelHeader`) — the same strip in the dashboard grid, in its own window
  and in the Manager's preview — which yields its height to the data on a card
  under 96 px tall. Its two actions sit in that header, shown on hover.
  **One exception: a `bare` widget** (`WidgetDef.bare`, the Radar today) has
  no panel, no paper and no header in its own window or in the preview — only
  its own marks. The Radar brings its own frame (the LED boxes) and covers as
  little of the game as it can; on the dashboard grid its header is still the
  grab strip and the home of its buttons, and shows on hover only.
- **A widget window obeys its dashboard.** A widget popped into its own
  window is configured under the Dashboard in the Manager, so it takes the
  Dashboard's Enabled switch, theme, saturation / brightness / opacity and
  "Hide when" rules exactly as an overlay window takes its own — plus its own
  toggle in the Widgets list. One pure module (`lib/overlayVisibility.ts`)
  decides for both kinds of window; widget windows used to skip it, which is
  how those controls came to change the preview and nothing over the game.
- **No *app* surface uses enrichment.** No hero imagery, no illustration, no
  decorative background — the `.bg-blueprint` dot grid the Manager carried
  through 1.24 is gone with the rest of the decoration. Function carries every
  screen. The marketing surface is the one place
  images appear, and they are product captures rather than enrichment — see
  § The marketing surface.

## Fuel, in the sim's units

**Where iRacing already has a name and a unit for something, this app uses
iRacing's.** A driver reads our overlay and the sim's own black box in the same
glance; two vocabularies for one quantity is a reconciliation problem handed to
someone doing 200 km/h.

The case that set the rule is the safety margin. iRacing's
[AutoFuel](https://support.iracing.com/support/solutions/articles/31000169381-how-to-use-autofuel)
calls it **Margin (Laps)** — it "tells your crew chief how much margin you want
to have at the end of the race" — and so do we:

1. **The margin is a lap count, not a percentage of the tank.** It used to be
   5 % of capacity, which is the wrong unit for the risk it covers: the risk is
   *one lap more than the calculator predicted*, and a lap costs the same
   litres whichever car is holding them. Five percent of a 120 L LMP tank was
   two laps of cover; five percent of a 40 L Skippy tank was two thirds of one.
   The reserve in litres is now `marginLaps × perLap`, so it re-prices itself
   as the burn moves.
2. **The default is 1.0 lap, and a timed race may not go below it.** iRacing's
   own recommendation, for its own reason: a timed race's length is a
   prediction, and if the leader picks up pace the race runs a lap longer than
   the arithmetic said. A lap-limited race has a count that cannot move, so a
   smaller margin there is the driver's call.
3. **No margin before there is data.** Without a sampled burn there is no
   honest lap-to-litre conversion, so the reserve is `null` rather than a
   guess — the same position AutoFuel takes when it says "we do not have fuel
   data for you. Run some laps."

4. **A timed race's length comes from the leader, not from you.** AutoFuel
   works off "the leader's average laptime, predicted lap count", and it has to:
   the flag falls when the *leader* runs the clock out, so a driver a few
   seconds off the pace runs the same number of laps as the leader and not the
   fewer their own lap time implies. Dividing the time remaining by your own
   average — which is what this app did — quotes that driver too few laps and
   fuels them short by exactly the error.

   We do not compute the prediction ourselves. iRacing publishes it on
   `SessionLapsRemainEx`, and the bridge prefers that channel over the plain
   `SessionLapsRemain`, which is the unlimited sentinel in precisely the timed
   races where the question arises. Our own time-÷-lap-time estimate survives
   as the fallback for a session that has not published one yet, and the mock
   feed carries a leader-derived count so the demo exercises the same path.

## Dense tabular overlays

Standings and Relative are the densest surfaces in this app and the only ones
read at a glance while the user is doing something else. The geometry is fixed
in [`constants.ts`](src/components/standings/constants.ts): `ROW_H` 32 px, of
which the row's strip takes all but `ROW_GAP` 3 — and a brand mark the strip
less 4 px either side (`STANDINGS_BRAND_H`, 21; 24 on Relative's 34 px row),
so no mark ever reads as touching the strip's edge — — the two the rules below
buy back — `COL_LABEL_H` 10 and `CLASS_GAP` 10, plus `SESSION_HEADER_H` 42
when the § Session header is on. Every rule below is downstream of
the fact that a header band and a row cost the same height.

1. **No vertical rules; one hairline under each row.** Every row sits on the
   same neutral paper, divided from the next by a 1 px rule in
   `--color-divider` (white at 5.5 %, `.timing-row-rule`). This reverses the
   strip-per-row rule of 1.15–1.24, which separated rows by a 3 px seam of
   darker paper and drew nothing: that worked while rows were lit strips, but
   on one flat panel of graphite a hairline is the engineering-table device,
   and at 5.5 % it costs less attention than the seam's change of tone did.
   No banding: every row is the same tone, so no row is ranked by its ground
   (§ Two colour systems, rule 2).
2. **Class separation is a gap — and, on Standings, a band that earns its
   height by carrying the class's own numbers.** The gap does the separating;
   it reads pre-attentively and costs a third of a band. What the earlier absolutist version of this rule got wrong is that
   separation was never the only job. A class's **car count, strength of field
   and fastest lap** are per-class and per-group: the session header cannot hold
   them (it is field-wide) and no row can (it is one car). The band is the only
   place they exist, and a band that is *carrying data* is not the labelled
   band this rule was written against.

   `CLASS_BAND_H` is 30, not the 34 the old class header cost, because it is a
   strip's geometry — a name plus label/value pairs — rather than a row's.
   It is subject to rule 7 like everything else: no collapse, no solo, nothing
   to click. It appears only when the field is grouped by class (a flat table
   has one group and nothing to name), and it can be switched off from the
   Manager.
3. **Column labels are off by default, and when on they print in the top slice
   of the first row** of each group, out of flow, rather than in a header band.
   A persistent 28 px band was 13 % of a ~208 px six-row Relative spent on
   labels a returning user stopped reading in their first session.

   **The labelled row is one label slice taller** (`rowSlotHeight`: `ROW_H` +
   `COL_LABEL_H` on Standings, `REL_LABEL_H` on Relative), and clears the
   labels with that much top padding, so its content keeps a full row's height
   under them. The labels used to cost no height at all — the host row simply
   padded its own content down — which left that one row 19 px of a 29 px
   strip: a 24 px brand mark and a 20 px licence pill broke out of the bottom
   of it. Ten pixels per group, paid only by a driver who turned the labels
   on, is the cheaper failure.

   The default flipped to *off* because "costs no height" was answering the
   wrong objection. The cost of a label a driver has already learned is not
   pixels, it is the glance spent skipping it — and on the one surface read
   without looking, that is the expensive kind. Learnable once and then
   dismissable beats permanent: the labels stay one Manager toggle away, which
   is what keeps this from being the § Deliberately not adopted case of a
   Relative that is undecodable on a first run.
4. **Compound cells over extra columns.** A value and its delta are one cell in
   two voices — mono value in `text`, delta in `accent` or `danger` — not two
   columns. iRating + its change is the canonical case.
5. **Fill is rationed by meaning, not by count.** A *fill* is opaque and takes
   contrasting ink, and it is the loudest tool on this surface. Standings spends
   it on **status** and nothing else:

   - **the fastest lap** — in class (`accent`) or in the field
     (`sector-purple`), the one *computed* fill, obeying `on-accent`
     (§ Theme, rule 1), and repeated on the class band's `BEST`;
   - **a change of place** — for three seconds after a pass, the position cell
     becomes an arrow on `accent` (gained) or `danger` (lost). See rule 16.

   The test is whether the fill is a graded or changing value the driver has to
   catch. Nothing about identity is filled: class is a bar (§ Two colour
   systems, rule 2).

   **The licence and iRating pill is one flat, neutral cell.** Licence + safety
   rating and iRating + its projected change are one compound cell in two
   segments (rule 4): `A3.45 | 8895 ▲14`, both on the panels' section tone
   with a hairline where they meet. **The licence keeps its own colour** — it
   is the information; a driver knows the class of licence by it — but as a
   2 px bar opening the segment, taken a step toward the neutral, with the
   group letter in the label grey and the rating in the data grey. Through
   1.24 the segment's whole ground was the licence colour, lit from the top
   with a sheen, and the iRating segment a glass lift; a column of red,
   orange, yellow, green and blue blocks was the loudest thing on the table,
   beside the red, yellow and green that mean loss, warning and gain. The
   lit grounds are still in [`lib/ratingPill`](src/lib/ratingPill.ts),
   tested, for anything that needs a filled licence colour.

   The projected change carries its grade in its own ink and direction mark —
   `accent` ▲ for a gain, `danger` ▼ for a loss — in a fixed-width slot, so
   every rating in the column ends on the same vertical. The 2 px rule that
   used to grade it a second time went with the glass: on a flat neutral
   cell, coloured ink is already the only colour there. The two columns stay
   separately switchable; when both are on, the licence segment reaches
   across the column gap and the two square off where they meet.

   **The pill is on Relative too**, straight after the driver's name and
   before the brand mark: who the car is, then what it is, then where.
   **Without the projected change** — the owner asked for licence, safety
   rating and iRating there and not what the race is worth to each driver —
   so its iRating segment is narrower (3.2rem) and centres the rating, since
   there is no change slot for it to line up against. Licence and iRating are separate options
   there ("Licence / SR" and "iRating"), both on by default. A relative is
   about neighbours, and *who* a neighbour is — a 5k driver alongside or a
   1k one — decides how hard to race them as much as the gap does. The pill
   keeps its own grounds on a lapped row: lapped blue is ink about where a
   car is, and a rating is about who is driving it.

   **Every "which way" on the table is one mark**: a solid triangle, ▲ or ▼
   (`DirectionMark` in `cells.tsx`) — on the position-change count, the
   projected iRating change and the position flash alike. It replaced a
   stroked chevron that, at 12 px, was thinner than the digits beside it, and
   an arrow on the flash that was a third glyph for the same idea.

   This replaced the **tint** device — a ≤ 18 % wash of a value's own hue
   behind ink of that hue — that licence, iRating and position change used to
   wear. A tint grouped a compound cell on bare paper; on a strip it was a
   second ground inside the first. Position change is now coloured ink and a
   direction mark, with nothing behind it.

   **A chip in a column is sized by the column, not by its contents.** `8895
   ▲14` and `1423` hugging their own text are two different widths in the same
   column, which turns a grouping device into a ragged edge down the table —
   and puts the values themselves on different verticals, which is the one
   thing a column of numbers may never do. Both segments fill their cells, and
   the change gets a fixed-width slot.
6. **The name column is `minmax(0, 1fr)` and truncates last.** Every other
   column is fixed-width and mono; the name absorbs all slack. A layout that
   clips `Francois Sieg…` while fixed columns hold empty space has its
   priorities backwards.

   **A narrow overlay scales the table; it does not shorten it.** This rule
   used to end by dropping a column — sectors first, then position change,
   tyre, licence, iRating and on down a list — so that the type could stay at
   the size rule 8 argues for. Both halves cannot be had, and the wrong half
   was being kept: shedding columns means resizing the overlay silently changes
   *what it shows*, and nothing on screen distinguishes a column that was
   dropped from data that never arrived. A driver who sizes their standings to
   sit beside the mirrors has asked for a smaller table, not a different one.

   So the surface takes one scale factor — the width it has over the width its
   columns want — and draws everything inside it: type, rows, gaps, column
   widths, the § Session header above them. The layout tuned at full size is the
   same layout at half. It is `zoom` rather than `transform: scale()`, which
   matters here more than most places: a transform resamples what it scales and
   softens 12 px tabular digits at exactly the sizes where they are already
   hard, where `zoom` re-lays the text out and keeps it hinted.
   `lib/tableScale` owns the factor and is the only definition of what being
   scaled means.

   **Standings fits its height too, and never scrolls.** It takes the tighter
   of width and height (`fitScale`), so every row it shows is on screen at
   once. It used to fit the width and scroll for the rest, with a "follow my
   row" option to keep the player in view; on a screen with no controls that
   meant the back of a big field was never seen, and the option is gone with
   the scroll bar.

   **Standings shows a set number of rows per class, the way Relative does.**
   Fitting *every* car turned out to be the same silent failure as shedding
   columns, one axis over: a 40-car field in an overlay sized beside the
   mirrors drew 13 px names at a third of their size — all there, none of it
   readable at speed, and the window could only make it worse. So each class
   group is capped (`lib/standingsWindow`): the player's class keeps its
   leaders and the cars around the player, other classes their top runners,
   and a dotted marker in the position column shows where the order skips.
   The counts are set in the Overlay Manager — the driver chooses how many
   cars, and the window then only decides how large they are drawn, which is
   exactly the split Relative's "cars per side" makes. "Whole field" brings
   back the every-car fit for anyone who wants it.

   The scale never exceeds 1 — a wide overlay is a table with room around it,
   not a table blown up. On Relative it stops at `MIN_TABLE_SCALE`, below which
   that surface goes back to scrolling sideways; Standings has no floor,
   because it has no scroll bar to fall back to. That floor is a backstop against a
   table dragged to a sliver, not a claim about legibility; rule 8 is the claim
   about legibility, and scaling is in tension with it by construction. What
   settles the tension is who is choosing: the driver sizing the window is
   making the call knowingly, where a column vanishing was the app making it
   for them, silently.

   **Two things do not scale.** The 3 px class-colour edge divides the factor
   back out and holds its drawn size, because it went to 3 px precisely to stop
   disappearing in peripheral vision and a uniform scale takes it back under
   the 2 px already rejected — see `CLASS_EDGE_WIDTH`. And the § Session header
   and class band are handed the width they have to draw *in* rather than the
   window's, so they keep every field at the sizes this rule exists to keep
   them at. What holds its size is what carries presence rather than quantity.
7. **Nothing on an overlay screen can be aimed at** — Standings, Relative and
   Fuel & Strategy. No title bar, no controls, no menus, no per-class
   affordances. These are the surfaces read while the user's hands are busy,
   and the one place the rule is not yet true is recorded in § Known
   follow-ups. Everything configurable lives in the Overlay
   Manager, which is the surface built for configuring; a setting with no home
   there is a setting these screens do not get. The screens therefore have
   exactly one form, and the Manager preview renders that same form — a preview
   that is interactive where the overlay is not is a preview that lies.

   The rule is about *interaction*, not about chrome, so a **pure readout is
   allowed above the rows**: the § Session header below, the per-class band in
   rule 2, and the fuel screen's `MARGIN 1.0 lap`. None has a button or rewards a
   click, and the first two are Manager toggles, so they cost the driver
   nothing to ignore.

   **Fuel & Strategy came under this rule late.** It shipped with a reserve
   stepper, a pit-fuel override and a collapsed "Pit strategies" section, which
   made it the one overlay that asked the driver to aim at something — and the
   disclosure was the worst of the three, trading a glance for a click on a
   surface read at speed. All three are gone; the plans are always open. Their
   two settings sit at defaults taken from the sim (a 1.0-lap margin, pit fuel
   as needed — see § Fuel, in the sim's units), and by the sentence above,
   either one may come back only in the Manager.

8. **Type on these two surfaces runs one step larger than anywhere else in the
   app.** 13 px names in Inter 500, 12 px values and 14 px positions in the
   mono (positions at 600), on `ROW_H` 32 (Standings) / 34 (Relative). Size
   carries the hierarchy and weight backs it up — through 1.24 every overlay
   was bold throughout, which at this density read as shouting rather than as
   emphasis. Every other
   surface in this system is read by someone looking *at* it; these are read in
   peripheral vision at 200 km/h by someone who must not look away for long.
   The density lost to the extra pixels is bought back by rules 2, 3 and 7,
   which is what those rules are for.

9. **They paint on their own graphite paper**, `--color-timing-bg` — `bg`
   taken 14 % toward black, the darkest graphite in the palette and never pure
   black — and they keep it nearly opaque over live footage (92 %) instead of
   dropping to glass. A 32 px row of 12 px figures cannot afford to let a
   sunlit kerb through. The token carries the active theme's hue so the
   surface stays part of the system.

   **On these two tables the paper is laid per block, and the space between
   blocks is clear.** The session header is one block, each class band
   another and each class's rows another (`.timing-paper` under a
   `.timing-blocks` surface). Inside a block the rows sit **straight on the
   black, edge to edge** — `--color-timing-row` is cleared there, and each
   row fills its whole slot, so there is no `ROW_GAP` seam and no frame of
   paper round the block: the owner read those seams as a black border round
   every row, and they cut the class bar into a piece per car. Now a class's
   bar runs down its group as one line — **drawn once per run of same-class
   rows, behind them**, not once per row. Abutting
   per-row pieces still showed a hairline at every join whenever the table
   was scaled, because `zoom` puts the joins on fractional pixels and two
   anti-aliased edges never quite cover one. On Relative, where classes
   interleave, each stretch of same-class neighbours shares one stripe and
   different classes meet with nothing between them (the space either side
   of the player's row, rule 14, stays). The player's accent ground marks
   theirs. The `CLASS_GAP` between
   two class groups, the same gap between the header and the field, and the
   `BAND_GAP` between a band and its rows show the game through. The owner asked
   for it: a single slab of black the size of the whole field hid more of the
   track than the data needed, and the clear gaps do rule 2's separating with
   the footage itself. The legibility argument above is untouched, because it
   was about the ground under the *type*, and every row, band and header still
   has opaque paper under it. On Relative the field is one block, so the only
   clear gap is the one under the header.

   **The blocks are panels: the system's 3 px radius and a 1 px edge**
   (`.timing-block`). They were rounded to 8 px for 1.20–1.24, so that with the
   game showing between them they read as panels laid over the footage rather
   than cells of one card; the 1 px edge does that now, at the radius every
   other panel has. The edge is an `outline` inset by its own width, so it is
   painted over the rows and the class bar inside and costs no layout.
   Everything in a block is drawn *inside* it and clipped to it — on
   Standings each row, band and class run is positioned from its block's top
   rather than the field's — so the class bar and the player's ground stop at
   the panel's edge.

   **Nothing in Tauri makes the gaps clear; the overlay windows already
   are.** Each pop-out is created `transparent`, without decorations and
   without the OS shadow (`lib/overlayWindows.ts`), and paints a
   transparent page (`overlay-mode`). The gaps show the game in those
   windows and in an OBS browser source; in the main window and the
   Manager's preview they show the app's own background instead.

   **This paper is no longer only theirs.** It was, on the argument that a
   gauge can afford a kerb showing through where a table cannot — but that
   argument was about legibility, and a fuel figure read mid-corner needs the
   ground as much as a lap time does. Fuel & Strategy and every dashboard
   widget now carry `.timing-surface` too, in the overlay, in its own window
   and in the Manager's preview. What is left on glass is the frame around
   them, which carries no data. A dashboard where half the cards were paper and
   half were glass read as two products.

10. **A lap that grades is ruled, not recoloured.** The last-lap cell keeps
    its data-grey digits and takes a 1.5 px underline in `accent` (personal best) or
    `sector-purple` (session best). The last lap is the number a driver is
    actually comparing against the car ahead, so it has to stay readable *as a
    time* first; grading it by recolouring the digits trades legibility for the
    grade, and the underline carries the same information in the same glyph box
    at no cost. `sector-purple` still colours the digits themselves, because a
    session-best lap is an event rather than a comparison.

11. **Ink on identity colour is never assumed.** Even inside a palette this
    app owns, the five-colour ramp spans violet at L≈0.24 and lime at L≈0.65:
    white reads on one and vanishes on the other, and `on-accent` does the
    reverse. A single declared ink on *solid* class colour is wrong for half
    the ramp whichever one you pick.

    There are two honest ways out, and these surfaces have used both. While
    the class band, the position block and then the Relative's class badge
    were solid class colour, each chose its ink from its own fill's WCAG
    luminance with `readableInk` in [`lib/contrast.ts`](src/lib/contrast.ts).
    Now nothing on either surface prints on solid class colour, and the
    measuring moved from the ink to the ground:

    - **The class fill is held weak enough for white.** Where the position
      digits sit, white has to clear 4.5:1 over every ramp colour, on the
      neutral strip and on the player's lighter one, measured at the left
      edge of a two-digit position, the strongest point under any digit
      ([`lib/classFill.test.ts`](src/lib/classFill.test.ts)). The test, not
      taste, sets how strong the fill may be: a profile a step stronger fails
      on lime, and on cyan under the player's ground.
    - **A class's name carries its own edge** — the Relative's badge and the
      Standings band's name alike are outlined in black at 85 % under the
      glyphs, so the name, in its own class colour, clears 4.5:1 against the
      outline even over that colour at full strength (violet is the closest
      call). Class-coloured ink straight on its own class's fill has no edge
      to read by otherwise.

    `readableInk` has no caller as a result. It is kept and tested on purpose:
    the next thing that wants solid class colour under text will need it, and
    this rule is why.

    **Since 1.25 neither way out is needed**, because no ink sits on class
    colour at all: the class fill and the outlined, class-coloured name are
    gone (§ Two colour systems, rule 2), and a class is a bar and, on
    Relative, a grey tag opened by one. `classFill` and `CLASS_NAME_OUTLINE`
    stay in [`lib/classFill.ts`](src/lib/classFill.ts), tested, for the same
    reason `readableInk` does — and their contrast tests still hold over the
    new ramp. The band's session-best lap keeps its purple fill — it reads
    the same on a band as it does on a row.

12. **A column that would lie in this session is not shown in this session.**
    Almost every number on these two surfaces is a race concept wearing a
    neutral face. Gap to leader, interval, positions gained, `-1L` — each one
    assumes the field is running a common distance and that track position is
    worth something. In practice, qualifying or a test session none of that
    holds: drivers join when they like, run their own programmes and pit at
    will, so the car two seconds up the road may be eight laps apart from you
    on the timesheet. The numbers keep rendering, and every one of them is
    false.

    So outside a race the two screens change what they are.
    [`lib/sessionKind.ts`](src/lib/sessionKind.ts) answers one question —
    is the field ranked by lap time or by distance covered — and:

    - Standings becomes a **timesheet**: ranked by best lap, with `gap`,
      `interval` and `change` dropped. The ranking is derived on the client, so
      the position column prints *that* rank rather than iRacing's, and the
      `best` column becomes structural in the sense `pos` and `driver` are —
      never user-hidden, never auto-dropped, because a table ranked by a column
      you cannot see is a table in no order at all.
    - **Qualifying's board starts empty.** A car is on it once it has set a
      time, and not before (`lib/lapTimeOrder.timedOnly`); a class nobody has
      timed in yet has no band. Practice keeps its untimed cars at the foot of
      the sheet, because there the garage is part of the picture; in
      qualifying a car without a time has nothing to be ranked by, and the
      board filling up *is* the session. How a car arrives on it is rule 17.
    - Relative **stops calling neighbours lapped traffic**. The tag and the
      blue ink are a race warning: they mean someone is losing a position
      or about to take one. Left on in practice they land on nearly every row —
      a table shouting at every row is a table saying nothing — and they bury
      the one number that still matters there, the gap to the car arriving in
      your mirrors mid-lap.

    **Nothing announces the switch**, and that is the restraint the rule turns
    on. The § Session header already names the session; the missing columns are
    themselves the loudest possible signal; and a timesheet whose fastest-lap
    fill (rule 5) is always its own first row says what it is without a label.
    A banner reading `PRACTICE ORDER` would be a header band by another name,
    which is what rules 2 and 3 spent their whole argument buying back.

    An **unrecognised** session name keeps the race behaviour. Hiding columns
    on a guess is worse than showing a number the driver can judge themselves.

13. **Standings reads rank, car, driver — then the data.** The column order is
    `pos · Δ · # · make · flag · NAME` and then the timing columns. Position
    leads, flush against the class bar and directly under the band's class
    name, so the band's name and the column of positions it heads share one
    vertical. Position change used to sit in front of it, which put a
    green/red status mark between the edge and the number it qualifies. The car's mark sits with its number and the
    flag with the name it belongs to, so the name column's slack (rule 6)
    falls *between* who-it-is and the timing data, instead of stranding the
    manufacturer mark alone in the middle of empty width.

14. **One coloured ground per surface, and it is yours.** On Relative, as on
    Standings, every row is a neutral strip and the player's is the only one
    on `primary` or with a ring. Lapped traffic — a car a lap or
    more *behind* you, in a race — prints every value in `--color-lapped`
    blue with a `-1L` tag, the convention the sim's own blue flag and relative
    box already taught every driver. A car a lap or more *ahead* keeps the
    default ink and a `+1L` tag; everyone else is default ink.

    This replaces a `danger` ground on every off-lap row, which in a race
    neighbourhood mostly off your lap turned the table into a stack of red
    blocks — and before that a red ring on each, with the one ring that
    matters lost among them. Ink carries the status without competing with the
    player's ground; the class wash that sat on the remaining rows went for the
    same reason (§ Two colour systems, rule 2). On a lapped row the blue also
    outranks the gap's behind-red: the car is behind you by definition, and
    "lapped" is the louder fact.

    The player's row is set apart from the cars around it by equal space above
    and below rather than by `YOU` and `BEHIND` micro-labels: two labels for
    three groups, one of them naming a row the ring already names, while the
    gap's sign and colour say ahead or behind on every row.

15. **A cell's colour has to mean what the colour table says it means.** The
    tyre cell used to colour its compound letter by compound — `accent`,
    `warning`, `danger`, `sector-purple` — which put an alarm-red `B` on a
    third of a healthy field and spent overall-best purple on a tyre. Nothing
    about a compound is good, cautionary, critical or a session best.

    What a compound *does* have is a colour every driver already reads: blue
    for rain. So the cell — on both tables, see below — is a ring with one
    letter: **`D` in the label grey (`muted`) for a dry, `W` in
    `--color-tyre-wet` blue for a wet**, then laps on the set in the row's
    ink. A dry is the ordinary case and recedes; the wet is the one that
    means something. Blue is its own token,
    fixed and unthemed like `lapped` and deeper than it, so a wet badge on a
    lapped row still reads as a badge (§ Theme table).

    **The badge is the brand mark's height** (`BRAND_ICON_H`, 24 px, on
    Relative; `STANDINGS_BRAND_H`, 21 px, on Standings), and its letter the
    name's 13 px. Side by side on the row, a 24 px roundel beside a
    17 px badge read as a large thing and a small one, which ranks two facts
    about the car that are equal; at one height they read as a pair. The
    column is 3.4rem, so a three-digit lap count still fits beside it.

    This reverses two earlier calls. A letter in a ring was rejected because at
    the table's smaller scales an 8 px letter in a thin 15 px circle read as a
    clock face; the badge answers that with a heavy ring and a bold letter set
    as large as the ring allows, and with colour carrying the distinction a
    second time — a 1.25-unit ring and a semibold letter since 1.25, light
    enough to sit beside the mono figures. And a side-on tyre glyph — slick hub or water drop, shape
    only — replaced the letter; at row size that asked the reader to tell a
    dot from a drop.

    **The tyre is on both tables, and optional on both.** It moved to Relative
    alone for 1.15: whether the cars around you have gone to wets, and how old
    the rubber is on the car you are about to race, is a question about
    neighbours, which is the Relative's whole subject. That call is reversed
    for Standings, not for Relative. The whole-field version of the question
    — who pitted for wets, who is on an old set in a long stint — has no other
    place to be answered, and the column's cost on the widest surface is the
    driver's to pay or not. On Relative it is the "Tyre compound" option; on
    Standings it is the `Tyre` column, between the lap times and the sectors.
    Both are on by default.

    The same rule covers alignment. **Every lap cell carries the fastest-lap
    chip's padding, filled or not**, so the filled time sits on the same
    vertical as every other time in its column. Padding only the filled chip
    pushed the one number the others are compared against out of line with
    them.

16. **A change of place is held long enough to be seen.** Rows glide to their
    new slots in 220 ms, and under reduced motion they do not glide at all; a
    driver who glances over a second after a pass sees a table in a new order
    with nothing to say what changed. So for three seconds the position cell
    of each car that moved is covered by a chip on a status fill — `▲ 3` on
    `accent`, `▼ 4` on `danger`, `on-accent` ink, at the pill's height
    ([`lib/positionFlash.ts`](src/lib/positionFlash.ts)). A change of what the
    number *means* — grouping switched between class and overall —
    re-baselines silently rather than flashing every row.

    **The chip keeps the number.** It used to be an arrow alone, which cost
    the new position for three seconds — the one fact a driver looking at
    the position column came for, swapped for the fact of a change. The
    arrow and the number fit side by side in the column, so nothing has to
    be traded.

    **It arrives and leaves; it does not blink.** The chip used to appear and
    vanish on single frames, so its last moment read as a fault rather than
    an end. It now fades in on `--dur-mid` with the row's glide, the arrow
    arriving the way the car went (rising for a gain, dropping for a loss),
    and dissolves back into the plain number at the end of the hold. Its own
    number sits half an arrow right of the plain one, so on the way out the
    arrow leaves first and the number slides home before the chip fades —
    both numbers are the same glyphs in the same place while they show
    through each other, and the crossfade never prints the position twice.
    Every phase is opacity or a transform. Under reduced motion none of it
    runs: the chip shows for the hold and goes (`.pos-flash` in
    `src/styles.css`).

    The leader's row has no gap and no interval, so those two cells print
    **`GAP` and `INT`** instead of two em dashes: on the one row where the
    number cannot exist, the cell names its column rather than reporting
    something missing.

17. **In qualifying, a lap is an event, and the row says so.** Two effects,
    both laid over the strip (`.row-fx` in `styles.css`) and gone again, and
    both qualifying-only — in a race the best lap is a footnote to the order
    and nothing flashes for it.

    - **Arrival.** A car that sets its first time joins the board: its row
      slides 10 px in from the left as it fades up, a faint sweep crosses it once,
      and the rows below glide down to make room on the ordinary row glide.
      Only rows that mount after the screen's first paint arrive — a board
      already full when the overlay opens just appears.
    - **Improvement.** A car that beats its own best takes a sweep and a low
      tint across the row in the lap's own grade, with a 2 px bar of it at the
      row's left — `accent`, or `sector-purple`
      when the new lap is the session's best, which is the meaning both
      colours already carry on the lap cells (rule 10). The tint holds for
      `LAP_IMPROVE_MS` and dissolves the way the position flash does
      ([`lib/lapImprove.ts`](src/lib/lapImprove.ts)). A first lap is not an
      improvement; that is the arrival.

    **A lap that also changes places fires both**: the row sweeps for the
    lap, glides to its new slot, and the position flash (rule 16) flags the
    places it took — and every car it passed flags `▼`. The two say
    different things, *went faster* and *moved*, and in qualifying either
    can happen without the other.

    This is the one place § Microinteractions' "silent success" bends, and
    it bends for the same reason rule 16 exists: a qualifying board changes
    between glances, and a driver looking over a second later should see
    which line just changed. Every phase is opacity or a transform. Under
    reduced motion there is no slide and no sweep; the arrival is the row
    appearing, and the improvement's tint shows for the hold and goes.

18. **Who is on the radio is a mark after their name.** iRacing reports one
    car keying the radio at a time (`RadioTransmitCarIdx`, carried on the
    row as `isTransmitting`). While it does, Standings puts a radio mark
    straight after that driver's name, in the name's own `text` ink, and
    the mark transmits until the mic is released: it pops in, its near arcs
    light and then its far ones, so the signal travels out from the mast,
    and a ring ripples away behind it (`RadioMark`, `.radio-live`). A mark
    that only faded in place was too quiet to catch from the corner of the
    eye, which is the only way this table is read mid-corner; this is the
    same exception rule 16 makes for a change of place. Opacity and
    transforms only, all on one 1.2 s beat.

    - **After the name, not in a column.** It is a fact about the driver,
      read in the same glance as who they are, and it is there a few
      seconds a minute; a column for it would be empty almost always. The
      name truncates before the mark does.
    - **Ink, not a status colour.** Talking is not good, cautionary or
      critical (§ Theme), and `primary`, the one informational hue, is
      already the player's own row's ground — a mark in it would vanish
      there.
    - **Not the state column.** That column holds the pit and off-track
      marks, which are about the car; a driver can be on the radio in the
      pit lane, and one would hide the other.

    Under reduced motion none of it runs: the mark is a still,
    full-strength glyph with no ripple.

19. **Race control's flags on a car are marks after the name too.** iRacing
    flies four flags at a single car, in its per-car `CarIdxSessionFlags`
    (carried on the row as `carFlags`, most severe first): disqualified, a
    black flag (a penalty to serve in the pits), the meatball (damage the
    car must pit to repair) and the furled black (a warning: slow down, or
    be penalised). Standings prints each as a mark straight after the
    driver's name (`CarFlagMarks`, [`lib/carFlags.ts`](src/lib/carFlags.ts)):

    - a **solid flag** for the black flag;
    - **a flag with a disc in it** for the meatball — the marshal's flag
      with its disc kept and its orange dropped, since orange is a class
      colour (§ Two colour systems);
    - **a gauge with its needle down** for the slow-down. It draws what
      the driver has been told to do rather than the furled flag, which
      nothing at row size can draw so that it reads as furled;
    - **`DQ`**, lettered, for a disqualification, the one state timing
      screens have always spelled out. It shows alone: a disqualified car
      has no penalty left to serve and no race to repair the car for.

    The rules, and why:

    - **The session header's inks** (`lib/sessionStrip`): `danger` for the
      three the car must act on — a black flag drawn in black on this paper
      is nothing — and `warning` for the slow-down, which is still a
      warning. The same flag never takes two colours on one screen.
    - **After the name, for rule 18's reasons.** A flag flies for seconds
      to minutes and on few cars, so a column for it would be empty almost
      always, and the name truncates before the marks do. They print
      *before* the radio mark, so a driver keying the mic never moves them.
    - **Not the state column.** A car serves a black flag in the pit lane,
      and the wrench and the flag would hide each other.
    - **Still.** No pop and no pulse: a flag stays up long enough to be
      caught on the next glance, which a three-second radio call does not.

### The class band

One line opening each class group on Standings:
`GT3 · SOF 4078 · ⛑ 6 · BEST 2:15.239`.

- **The band is its group's header.** A header strip (`--color-panel-header`)
  opened by the same 3 px class bar the rows carry, on the same vertical, so
  the band's bar and the rows' make one line of class colour down the group —
  in a multiclass session; in a single-class one the bar is the neutral
  hairline tone. The bar is the band's only class colour: the class name is
  neutral ink. It used to be the class colour **solid** across its whole
  width, then a fill behind a class-coloured, outlined name; see § Two colour
  systems rule 2 for why both went.
- **It is a heading because of what it says and where it sits, not because of
  its colour.** The class name opens it, at the names' 13 px, semibold, caps, with a
  minimum width equal to the position column's so `GT3` sits centred over the
  column of positions it heads; its `ml-1` matches the row's `px-1`. And it is
  set apart from its group by `BAND_GAP` 6 under `CLASS_BAND_H` 30 — a band
  flush against the first row reads as that group's first entry. The gap is
  clear rather than paper: the band is a block of its own (§ Dense tabular
  overlays, rule 9), so over live footage the game shows between a class's
  name and its first position, as it does between classes.
- **It speaks the strip grammar**, `StripField` — sans-caps labels and mono
  values, one line of label/value pairs, which the session header spoke too until it became a
  row of its own (§ The session header):
  `SOF` in full (`4078`, not `4.1k` — a rating is four characters either way,
  and the abbreviation threw away the digits a driver compares), the car count
  behind a helmet glyph (the population the other two measure, so a glyph
  rather than a word), and `BEST`.
- **`BEST` takes a `sector-purple` fill** when that class's fastest lap is also
  the session's — the same meaning purple carries in every row.
- **Fields drop right-to-left as the overlay narrows**: `BEST`, then the car
  count, then `SOF`. The class name is the last to go, because a band that has
  clipped its own name has stopped doing its job.

### The session header

One row above the field, on both timing surfaces:
`RACE · Circuit de Spa-Francorchamps / GRAND PRIX PITS · LAP 15/≈25 · LEFT
23:47 · INC 7x · TRACK 31° · AIR 22° · SOF 4297 | TIME 18:16`.

- **It is a different row from the ones it heads, and looks it.** It used to
  be a strip like the rows — the same `--color-timing-row` ground, near a
  row's height, one line of label/value pairs — on the argument that the
  surface should read as one stack of strips: session, class, cars. It did,
  and that was the trouble: it read as the table's first row, and a plain
  one. So it is its own device (`.session-header` in `styles.css`):
  `SESSION_HEADER_H` 42 against a row's 32, a flat header panel on the
  panel-header tone with the system's 1 px edge. Through 1.24 it was lit from
  the top with a sheen, a soft shadow and the flag's colour fading along its
  foot; the height and the stacked fields set it apart on their own, and the
  rest was the decoration this direction removes.
- **Every field is a stack, a word over a value.** A 9 px sans-caps label
  (`label-caps`) over a 16 px mono value in `text` — larger than the
  rows' 12–14 px because the header is read before they are, and a readout
  set at the rows' own size read as a row. The lap's distance is set smaller
  and `muted` beside the lap itself (`15/≈25`): the lap is the number, the
  distance is what it is measured against. This is still the § Deliberately
  not adopted note on icon-only strips, cashed in: a thermometer glyph the
  user has to *learn* is not a readout, it is a quiz.
- **The track is named**, the circuit at the names' 13 px over its layout
  in the label voice. It is the one field that never changes during a
  session, so it is the one that gives way: it takes the header's slack,
  truncates, and is the first to drop as the overlay narrows.
- **`SOF` prints in full**, as on the class bands and in the iRating column.
- **The session tag is the header's only fill**, and the active flag is what
  fills it — flag state is the one thing here that changes what the driver
  does next. Filled ink obeys § Theme rule 1. No glow and no sheen: a solid
  semantic block on a flat grey header is already unmistakable. With no flag
  flying, the tag is outlined rather than filled. Flag colour comes from the
  *status* table, not from the marshal's flag: a black flag is `danger`,
  because black on black is nothing.
- **One rule, before the clock.** The clock is the driver's time rather than
  the race's, so a hairline sets it apart at the right-hand end. Rule 1's ban
  is on rules between *rows*; this one is inside a header.
- **The lap field projects a distance for a timed race** (`6/≈36`, from time
  remaining ÷ estimated lap) rather than showing a bare lap counter. "Am I on
  the last lap" is a fuel and tyre decision, and a timed race never publishes
  an answer.
- **Fields drop right-to-left as the overlay narrows**, in priority order, the
  same way the table scales — the track first, then the clock, SoF and on
  down. The last field standing is the lap.

### Fuel & Strategy in the timing language

Fuel & Strategy shares the timing paper (rule 9) and the no-aim rule (rule 7);
it now shares their grammar too, because a driver glancing from the standings to
the fuel panel should not have to re-learn where the numbers are.

- **A strip, not a title bar.** `FUEL · <track> · MARGIN 1.0 lap`, at
  `STRIP_H` 26 on its hairline — the height the session header had while it
  was a strip — built from the strip's own `StripField`: sans-caps labels, mono
  values, the system's one label voice. The icon-and-heading title it replaces
  was the last piece of window chrome on an overlay screen. The `FUEL` tag is a
  label, unfilled.
- **Sections are panels inside the panel.** One step of lift
  (`--color-section`) and a 1 px hairline (`--color-divider`), headed by a
  channel label — not bordered `surface-2` graphite, which read as a second
  product pasted onto the first. The dashboard's Tyres corners take the same
  ground for the same reason.
- **Label over value, unit after it.** A metric is a `label-caps` channel name
  over its mono figure, with the unit a size smaller and dimmer.
- **Bars are square-ended on a visible track**, like every dashboard bar. A
  rounded pill on a track the colour of its card read as a lozenge floating in
  space rather than as a level in a tank.
- **The verdict is a 2 px status bar, not a tinted block.** The verdict line
  — `Pit stop needed`, `Finish on fuel` — is set in its status colour, and the
  section carries that colour as a bar down its left edge and on its icon's
  ink. Through 1.24 the whole block was a `color-mix`ed tint of the status;
  coloured backgrounds are what this direction removes, and a bar says the
  same thing in the place the eye starts reading. The tank level is the data
  neutral, and turns `danger` only when it is low enough to mean something.
- **Plans are rows, not pills.** The plan name sits in a fixed-width label slot
  so stops line up down the list; the recommended plan wears a low accent
  ground and an accent ring — the same "selection" statement the player's row
  makes — rather than a border style of its own.
- **The lap history is a dense table in miniature.** `Fuel per lap`, under the
  plans: one row per completed lap, newest first so the lap just finished sits
  where the glance lands, with a hairline under each row and no vertical
  rules (§ Dense tabular overlays, rule 1). The burn is the row's figure, in
  the data ink; lap, time and tank are context, in the label grey. Its
  delta against the strategy's per-lap average takes `accent` under and
  `danger` over, rounded before it is graded so a lap never prints `0.00` in
  red. Two marks, both words or glyphs rather than colour: `PIT` after the lap
  number for a lap that touched pit road or crossed a refuel, and `~` before a
  burn scaled up from a part lap — the same `~` as the stint's `of ~N`.

  It carries column labels, which rule 3 turns off by default on Standings and
  Relative. The case there is a label paid for in every group by a driver who
  learned the columns in their first session; here one row of labels heads the
  whole table, and five columns of bare litres and seconds are not learnable
  the way a standings row is — `2.83` and `11.6` are both litres and only the
  label says which is the lap and which is the tank. It is not interactive
  (rule 7): no sorting, no selection, and a table longer than the window
  scrolls with the rest of the panel.

### The Coach in the same language

The Coach screen (`components/coach/CoachScreen.tsx`) is drawn from the Fuel
panel's parts and obeys rule 7 like it: nothing on it can be aimed at, and its
two preferences — the smallest loss worth a tip, and how many tips — live in
the Manager (`useCoachUiStore`), applied at render time by `lib/coaching.ts`.

- **One loud block.** The first tip carries its grade as a 2 px bar and its
  headline in the grade's ink, exactly like the Fuel verdict; further tips
  take a neutral bar and grey headlines. Two coloured blocks stacked read as
  two alarms of equal weight, and they are not — the list is ranked.
- **Status colour only, in the Standings' sector grammar.** Gained is
  `accent`, lost is `warning`, lost a lot is `danger` (three tips' worth, never
  under 0.25 s). The first reference lap is `primary` — information, not a
  verdict. No corner is ever drawn in class colour: § Two colour systems.
- **The wording is the product.** A tip says the cause *and* its number —
  "Braked 14 m early", not "Braking" — because a cause without a size is not
  something a driver can change on the next lap. The supporting line holds at
  most three numbers, and never repeats the headline's.
- **Habits, not one-offs.** "4 of the last 6 laps" appears only for a cause
  repeated at least twice. A single mistake is noise the driver already felt.
- **The arithmetic closes on screen.** The corner list ends in a `Lap` row equal
  to the sum of the rows above it, because the bridge's segments partition the
  lap. A coach whose corner losses do not add up to the lap is a coach nobody
  trusts with the next one.
- **The strip's Δ steps aside on a new best.** When the last lap becomes the
  reference, `REF` and `LAST` are the same time and a delta beside them reads
  as a bug; the headline carries it instead.
- **It moves once per lap.** The headline fades up (`.coach-in`, 200 ms, off
  under reduced motion) when a new analysis lands at the line, and holds still
  until the next one — the one moment the driver might glance across for it.
- **Traffic is not a tip.** A corner the bridge marks as traffic shows in the
  list with its loss and a `Traffic` tag, and never becomes advice.
- **The session best is the field's number, in the field's colour.** Beside
  `REF` and `LAST` the strip carries `BEST` — the fastest clean lap anyone in
  the player's class has set — in `sector-purple`, the colour every
  overall-best lap wears on Standings. In a one-class session that is the
  whole field; a GT4 is never held against an LMP2, whose lap loses time in
  every corner for reasons no driver can fix. It moves the moment someone sets
  a new one, not at the player's line.
- **Against the session best, time only.** The `Session best` section is the
  corner list's grammar — diverging bar, time, a `Lap` row that sums the rows
  — with the cause column left empty: the bridge times other cars from lap
  distance (`coaching/field.py`) and has nobody's pedals but the player's.
  Causes stay with the coach's own reference, which it can measure. The
  section's header names whose lap it was and its time, because "you lost
  0.4 s at Pouhon" means nothing until you know to whom.
- **Compared first, kept after — both references.** A lap that beats the
  session best is held against the old one before it becomes the new one,
  exactly like the coach's own reference, so a new best still shows where it
  came from. The player's own clean laps count; theirs is a session best like
  anyone's.

### The Radar

The Radar widget (`components/widgets/RadarWidget.tsx`) is for the driver with
one screen: the car in the blind spot is a voice from the spotter, and the
widget makes it a light. It is a widget, not an overlay with a manager page —
it has nothing to configure.

**Its third form.** 1.24 drew a map: your car in the middle, a car alongside
one lane over, a dashed bearing and a printed angle, on a panel with a header.
Drivers could not read the overtaking car off it — the angle mixed a measured
gap along the track with an assumed one across it — so it became two bare
lines with the car's stretch lit on them. That never shipped: before the
release the driver asked for the thing sim rigs actually bolt to the dash, an
LED letter box, and that is what it is now. The lines' argument still holds —
draw nothing the sim does not publish — and the box draws even less.

- **Two LED boxes and nothing else.** An `L` at the left edge of the window,
  an `R` at the right; each a 9 × 9 dot matrix (`lib/radar.ts`, `GLYPHS`) in a
  carbon-weave frame (`.radar-box` in styles.css). No panel, no paper, no
  header, no words (`WidgetDef.bare`). Square, as big as the window allows
  with two side by side, so the window's width decides whether they sit
  either side of the car on screen or together.
- **The spotter is the whole input.** iRacing's `CarLeftRight` lights a side;
  nothing else can give a car a side. A side is never lit for a car the sim
  has not called, and always lit when it calls one, whether or not the bridge
  could match the car by lap distance (`telemetrylab/radar.py` still does, for
  the screen-reader label: "car left, 1.8 m behind").
- **…but it drops out, so a call is held.** `CarLeftRight` falls back to
  "clear" with a car still door to door whenever the sim decides one of you is
  not "driving" — off the throttle into a braking zone, out of the pits, at
  the flag — which is exactly when side by side matters. 1.27 trusted every
  frame of it and the boxes went dark mid-battle. Now a car the spotter has
  called keeps its side while the lap distances say it still overlaps you
  (`HOLD_M`, a car length); a side the spotter is calling is its own count.
- **Unlit is still legible.** A clear side's LEDs sit dark, the letter's in a
  trace of red, so the box says which side it is without lighting. A lit
  letter takes `--color-led-red` with a bright core and a glow.
- **Its own red.** `--color-led-red` is `danger`'s hue at full chroma. A lit
  LED is a light, not ink, and the softened status red read salmon once it
  glowed; this is the one place the radar's red parts from the timing
  screens' — on purpose, since this widget imitates a physical lamp.
- **No transition.** A side lights on the frame the spotter calls it and goes
  dark on the frame the car is clear — by the spotter, or by a car length of
  lap distance once the spotter has gone quiet. A fade would say "car" after
  the car has gone, which is the one error this widget cannot afford.

### Deliberately not adopted

Two things the reference does that this system rejects, recorded so a future
pass doesn't "fix" their absence:

- **A Relative with *no way* to see column labels.** Rule 3 now defaults them
  off, which is not the same thing: they are a toggle away, so a first run where
  `2.2`, `A3.6` and `3.9k` are undecodable is still recoverable. Removing the
  labels from the codebase, rather than from the default, is the thing that
  stays rejected.
- **Low-contrast car numbers.** `#30` in a near-`faint` grey fails the `faint`
  floor. Car number is `muted` at minimum — and on both timing surfaces now
  full `text`, since `muted` on a row strip read as disabled.

The strip-per-row look was taken from a second reference overlay, and three
things it does were left behind on purpose:

- **Lap times to the tenth** (`1:40.2`). The last lap is the number a driver
  compares against the car ahead (rule 10), and at the front of a field the
  difference is in the hundredths. Times stay `m:ss.mmm`.
- **The session readout folded into the first class band** (`R LMP1 6/≈35.80
  50:24/1h …`). The session header is its own Manager toggle and is shared
  with Relative, where there is no band to fold it into; it is a row of its
  own instead.
- **Icon-only fields** (a track glyph for temperature). See above.

Two things this section previously rejected have since flipped, and it is worth
being explicit about *why* each turned, so the next pass reverses them only for
a better reason than the last one:

- **Manufacturer marks** were drawn at 13 px in 55 % grey, on the theory that
  identity should stay quiet next to the status colours. At that size an Audi's
  four rings and a Porsche crest resolved to the same smudge in peripheral
  vision, which is the one place this surface is actually read. Now 21 px on
  Standings and 24 on Relative, in the data grey (white through 1.24), and
  **heavier than their artwork**: every shape is outlined in its own ink by a
  0.6 px screen-space stroke (0.9 px through 1.24, when every overlay was bold)
  (`.brand-icon` in `styles.css`), because marks cut for print — Mercedes'
  star, BMW's ring, the Aston Martin wings — thinned to hairlines at row size.
  Marks with lettering in them, or detail cut *out* of the ink, take a
  lighter stroke of their own (`MARK_STROKE` in `cells.tsx`), set by eye at
  1× scale, since the full one grows the ink into the counters of letters a
  few pixels tall: **none** on McLaren's and Dallara's wordmarks, Ford's
  script and RAM's lettering; **0.3 px** on the Porsche and Cadillac crests;
  **0.5 px** on Nissan's ring and the Aston Martin wings, whose hairlines
  vanish with no stroke but whose lettering closes at the full one. They all
  shared 0.3 px once, and McLaren's wordmark still printed as a white smear:
  the owner could not read it.

  The column is 4rem, and a mark is capped at 52 px wide — **60 px for the
  wide marks** (the wordmarks, Kia, the Aston Martin wings), whose width cap
  rather than their height decides how large their letters print. At the
  old 48 px cap a 5.5:1 wordmark set its letters 6 px tall. Even the widest
  mark still sits with paper either side instead of running into the number
  and the flag.

  **Marks are sized optically, not to one height** (`lib/markSize`). Drawn
  at the row's full height with only a width cap, a wide mark took three to
  four times the room of a narrow one — McLaren and Aston Martin 60 × 21,
  Audi, Ford and Chevrolet 52 × 21, Ferrari 15 × 21 — so the column read as a
  row of different sizes rather than a row of cars. Now a mark up to 1.3:1
  keeps the full height and anything wider is drawn at the area a 1.3:1 mark
  has, its aspect read from its own viewBox: Audi's rings are 39 × 15,
  McLaren's wordmark 56 × 10, a badge 21 × 21. Tall crests cannot grow past
  the row and stay a little lighter; the widest mark is now ~1.8× the
  narrowest, down from ~3.9×. The width caps stay as a backstop. This does not re-open
  § Two colour systems rule 2 — the mark is drawn in the row's own ink.
- **The class band** was rejected on the grounds that a gap separates classes
  for a third of the height. True, and irrelevant: separation was never the
  band's job. See rule 2.

The rejections that stand are both about *withholding information the reader
needs*, which is the pattern worth noticing — a rule that only removes chrome
is a rule that will keep getting revisited.

## The marketing surface

One page at [`site/`](site/), in two languages — `index.html` and
`es/index.html` — with three stylesheets and a few dozen lines of inline script
for the theme toggle and the mobile menu: no build step, no framework,
deployable as a folder. It is a **third surface class**, and the sharing rule
at the top of this file governs it exactly as it governs the other two — a page
selling an instrument that does not look like the instrument is selling
something else.

**Macrostructure: product landing.** The product owner asked for a page laid
out like the sim-racing overlay sites drivers already know (RaceLab's was the
reference), so the old Split Studio spine — one long column of claim/capture
rows alternating direction — gave way to the sections a driver expects to find
on one: a centred hero with the two actions, a stats strip and the product on
screen; the overlays as cards; the features; three install steps; the price;
open source; an FAQ; a closing call to action. The *layout* is borrowed; the
*voice* is not. Every colour, face, radius and meaning below is this system's,
and the honest-copy rule at the end of this section is untouched — the
reference's user counts, star ratings, game-logo strip and testimonials have no
equivalent here, because none of them can be measured for this project.

What survived from Split Studio is its one real rule: **every claim gets its
proof.** Each overlay card is a band, a heading, a paragraph and the capture
that shows all of it; the standings card still runs its capture the full width
of the shell, because twelve columns of 12 px type are illegible at half.

Nav is **N1 product**: wordmark left, the page's five sections in the middle,
language, theme, source and the download on the right; below 68rem the section
links fold into a menu. The middle links are not decoration added to an N9 row
— they are rule 8's readout, moved up into the bar. Footer is **a sitemap in
columns over the Ft5 wordmark**: the brand and a line about it, the page's links
grouped by what they are for, the colophon and the language switch, and the
cropped wordmark still the last element on the page (rule 5).

What it inherits without change: every colour token and every colour *meaning*,
Inter, the 4-point spacing scale, the three easings and durations, the 8-state
control contract, and the focus-ring rule.

Its cards take an 8 px radius, against the app's 3–4 px. That is a page-scale
step, not a new geometry: a 1,200 px card cut at 4 px reads as square-cornered,
and the captures inside the cards keep the app's own 4 px.

**§ Motion's reveal pattern is the one thing it no longer inherits.** This file
used to say that a marketing page which animates on scroll "would be the first
surface in this system to do so, and it does not get to be". It does now — the
product owner asked for it — so the rule is amended rather than quietly broken,
and rule 6 is the fence around it. The app surfaces are unchanged: nothing in
the manager or in an overlay animates on scroll, and nothing should.

Seven things it is allowed that no app surface is:

1. **A display type scale.** `--text-display` and friends exist only here. The
   app is read at a glance at 200 km/h and has no use for 4.6rem type; a page
   read at arm's length needs it.
2. **Real product captures.** They are proof, not enrichment: every claim on the
   page is verifiable in the image next to it. They are wrapped in a bare
   `<figure>` with a hairline border on `--color-timing-bg`, so a screenshot
   sits on the paper it was shot on. **No drawn browser chrome** — no URL pill,
   no traffic lights, no phone frame. A fake window only ever reads as fake.

   **One composite, and it says so.** The hero's stage places five captures on
   a 16:9 field of `--color-timing-bg` the way a driver arranges the windows
   over the game — standings top left, relative right, coach, fuel and the
   radar below. It is the product's whole idea (separate windows, not one
   dashboard) shown rather than told. Every image in it is an unretouched
   capture; the arrangement is the only thing composed, and the figcaption
   names it a composite so it is never read as one screenshot. The windows
   carry a drop shadow there and nowhere else: overlapping windows need
   separating, and lightness alone cannot separate five dark pictures on dark
   paper. Below 48rem the stage stops being a screen — five windows on a
   phone-width 16:9 would be five thumbnails — and becomes the two captures
   that still read at that size, stacked.
3. **A pinned mono.** The app bundles JetBrains Mono for every figure since
   1.25 (§ Typography); the site pins the same face from Google Fonts, since a
   public page cannot reach the app's bundle — and the mono is what makes the
   site read as the product rather than as a page about it. Its labels follow
   the app's: sans caps, mono values.
4. **One duplicated token file.** [`site/css/tokens.css`](site/css/tokens.css)
   copies the Carbon values rather than importing them, because the site must
   stay deployable as a folder. **A colour changed in `src/styles.css` has to be
   changed there too** — that is the standing cost of the site being standalone.
5. **One cropped element, and one condensed face to set it in: the footer
   wordmark.** It runs the full bleed of the viewport at ~18.7cqw and the bottom
   edge of the document cuts it through the middle of its x-height, so only the
   top of the letters survives. This is the single place in the system where
   something is deliberately incomplete, and where a second display face is
   allowed to stand beside Inter, so both are fenced hard:

   - It is the **last element on the page**, it is the **wordmark and nothing
     else**, and it takes a **border tone rather than an ink one** — at 300 px
     even `faint` reads as a headline.
   - It is **`aria-hidden`, `pointer-events: none` and unselectable**, with an
     `sr-only` copy of the name beside it. It is a shape; the string lives next
     to it.
   - **Anton is reachable only through `--font-display`**, and `--font-display`
     has exactly one call site ([`site/css/footer.css`](site/css/footer.css)).
     Inter still carries every heading, every line of body copy and every
     surface of the app. A second face anywhere else is the § Typography
     single-family rule being broken, not this allowance being extended.
   - The size and the crop are **two custom properties at the top of the
     component**, both tuned to this string in this face: the size is 100
     divided by the string's measured ink width in ems, the crop is half an
     x-height off the baseline. Change the name or the face and both need
     re-measuring — nothing here derives itself.

   **No product data is ever cropped.** A number the reader has to guess at is
   the failure mode this whole system is built against; a wordmark they already
   read at the top of the page is not.

6. **Scroll-driven devices — three of them, and each one reports or reveals
   rather than performs.** A fade on each card as it enters, a drift on the
   stage's windows as the hero scrolls away (each by its own depth, at most
   28 px, so the windows separate slightly — the composite reads as layered
   windows rather than as one flat picture), and a progress rule along the
   pinned nav that fills with how far down the page you are. That last one is the reason the set is
   allowed at all: a bar reporting a measured quantity is the same instrument
   voice as the § Session header, not decoration borrowed from a template.

   Five fences, and the first two are the ones that keep this from becoming the
   templated-editorial tell it usually is:

   - **Transform and opacity only**, per § Motion — never a layout property.
     The fade is opacity; the drift and the progress rule are transforms.
   - **Amplitude is the argument.** The drift is at most 28 px, over the first
     screen of scrolling: felt, not watched. At the 80–120 px a parallax
     library defaults to, a screenshot whose entire job is to be *read* would
     be sliding while you read it. It moves whole windows against each other,
     never an image inside its own frame — that reads as a bug.
   - **Never above the fold.** The fade's range ends inside `entry`, so
     anything already on screen when the page opens renders at full strength,
     and the drift starts at zero at the top of the page. A hero that fades in
     is a hero the reader waits for.
   - **No JavaScript in any of the three.** `animation-timeline: view()` and
     `scroll()` inside `@supports`, so a browser without scroll-driven
     animations gets the page exactly as it was. The fallback is *visible* —
     content stuck at `opacity: 0` because a feature query was skipped is the
     one failure these devices can produce, and it is unacceptable. (The page
     does now carry script, for the theme toggle; see rule 7. None of it
     touches these.)
   - **Off under `prefers-reduced-motion`**, by not being declared rather than
     by being overridden — a scroll-driven animation has no duration for the
     reduced-motion block to collapse.
   - **The app surfaces do not get this.** § Motion's reveal pattern still
     reads *none* everywhere else, for the reason it always did: a driver is
     not scrolling, and an overlay that faded anything would be hiding data.

7. **A light theme, and the ~30 lines of script that serve it.** The app is
   dark by necessity — overlays composite over live footage, the manager sits
   on a second monitor at night. A page read at arm's length in daylight has no
   such constraint, and half the people who open it have their OS set to light.
   So this surface, alone, has two papers.

   - **Colour meaning does not invert.** `accent` is still positive, `danger`
     still critical, `primary` still interactive. Only lightness moves, so each
     clears 4.5:1 against paper instead of against ink. The values are
     measured, and the measurements are in
     [`site/css/tokens.css`](site/css/tokens.css) beside them.

     Two of them moved on the pass that added rule 8, both by lightness only.
     **`warning` was failing** — 4.17:1 on the old paper, below the floor this
     bullet claims — and went from L 58% to L 54% for 4.6:1. And **the paper
     itself is a tone below `surface` now** rather than above it: at L 98.6%
     the page was brighter than every card sitting on it, which inverts the
     elevation direction the dark theme uses and reads as a document rather
     than as an instrument. `bg` L 96.4%, `surface` L 98.4%.
   - **`--color-timing-bg` stays dark graphite in both.** It grounds the product
     captures, and those are screenshots of a dark app. A light frame around a
     dark picture is a frame fighting its picture.
   - **`--color-on-accent` still means "the only ink allowed on a filled status
     colour"** — § Theme rule 1 is unchanged. On light paper the accents are
     dark, so the token resolves to near-white instead of near-black. The rule
     held; the value moved.
   - **Three states, not two.** The OS decides until the reader overrides it,
     and the override wins in both directions — so the palette is declared once
     under `prefers-color-scheme` and once under `[data-theme]`.
   - **The script is inline, synchronous and in the `<head>`**, because a
     stored preference applied after first paint is a white flash on a dark
     page. It sets one attribute. With scripting off the page still follows the
     OS through the media-query copy, and the toggle is simply a button that
     does nothing — the one thing it must never be is a page that renders
     unstyled or unreadable.

   This and the menu's one handler (below) are the only script on the surface
   and the only script this system has outside the app itself. Anything else
   that wants to be added here has to argue for itself the way these did.

   **The mobile menu** is a `<details>`, so it opens with scripting off. Its
   handler closes it after a link inside it is followed, and on Escape —
   without that a followed link leaves the panel open over the section it just
   scrolled to. It is a dozen lines and touches nothing else.

8. **The product's own readout devices, at page scale.** Rule 6 admitted the
   progress rule on the argument that *a bar reporting a measured quantity is
   the same instrument voice as the § Session header*. Three devices now cash that
   argument in properly, and all three are the app's own furniture rather than
   anything borrowed from a marketing template.

   - **The nav's section links are the page's readout.** The link for the
     section you are reading lights — brighter ink and a 2 px `primary` bar
     under it (§ Theme: selection) — and exactly one is lit at a time. It used
     to be a separate strip of micro-labels under an N9 nav row; the product
     landing has a link row in the bar anyway, so the readout moved into it
     rather than repeating it.

     It costs **no JavaScript**, per rule 6's fourth fence: five `view()`
     timelines declared on the sections and referenced from the dock through a
     `timeline-scope` on `:root`. The scope has to be on the root and not on
     `main` — the sections that *define* the timelines are inside `main`, the
     links that *reference* them are not, and the scope must cover both. Where
     scroll-driven animations are unavailable they are five plain links, which
     is what they are anyway.

   - **The stats strip is the § Session header.** Under the hero's actions, a
     panel with a filled chip (`v1.27`, in `accent` with `on-accent` ink, as
     the session chip fills with the green flag), the name over a caps
     sub-line, then small sans labels over large mono values divided by
     hairlines: `OVERLAYS 5 · WIDGETS 7 · THEMES 4 · FEED ~60 Hz · PRICE 0 € ·
     LICENCE MIT`. It is where the reference page put its user count and star
     rating; here every value is checkable in this repo, and the layout is the
     header across the top of the standings capture a few hundred pixels
     below it.

   - **The section band** (`.band`) opens every overlay card, the manager and
     open-source panels, in the § Class band's grammar: a chip naming the
     subject, then micro-label / value pairs carrying that subject's own
     numbers — `COLUMNS 15 · ROW 32px`. Section heads above the cards are a
     centred eyebrow, heading and lede instead; the eyebrow is the section's
     nav label, in `primary`, so it names where the lit link points. Every value is a fact checkable in this repo or in a capture on
     the page, so the band is inside the honest-copy rule below rather than an
     exception to it. Its 3 px leading edge is the standings row's left border
     at a larger scale — one device, three sizes — and it takes
     `border-strong` rather than a status colour, because on this surface it
     carries structure and there is no identity colour to quarantine
     (§ Two colour systems is a product-surface rule).

     This is the answer to a page that hosts the instrument in screenshots
     but would otherwise not speak its language anywhere else. Numbered
     section markers were tried and cut — the lit link already reports
     position, and an ordinal beside it is the decoration this system does not
     use. The install steps are numbered, because there the order *is* the
     information.

9. **Two languages, two files.** English at `/`, Spanish at `/es/`, each
   naming the other with `hreflang` and a two-way switch in the nav and the
   footer. With no build step there is no template to translate through, so
   `es/index.html` is a full copy of the markup with the text translated and
   every path one level up — same class names, same section ids (the readout
   keys on them). **Change one page and change the other.** The app's own UI
   labels stay in English inside the Spanish copy where the reader will see
   them in English on screen (`Mock data`, the capture text); Windows' dialog
   buttons are given as the Spanish Windows names them.

Two rules it does *not* get to break:

- **Honest copy.** No invented metric, download count, testimonial or logo wall.
  Everything the page asserts is either visible in a capture on the page or is a
  plain fact about how the software runs.
- **No hanging headers.** A heading parked in a left column with its body in a
  right one is banned here as it is everywhere else in this system. Section
  heads stack, centred.

## Provenance

The § Dense tabular overlays rules were extracted on 2026-08-08 via
`hallmark study` (image mode) from published screenshots of a third-party
timing overlay, as a public reference. What was taken is structural — row
grammar, where labels live, how colour is rationed. No palette, no typeface, no
markup, and no token value came from the source; every rule above is expressed
in this system's own tokens. Colour values here remain those of the four
runtime themes.

Rules 8–11, the § Session header and the § Class band were added on 2026-08-08
across two further passes over the same reference, after this app's surfaces
were read against it side by side. The same boundary holds throughout: what was
taken is *that* a timing overlay wants heavier type on darker paper, a readout
line of session state, per-class mastheads, and compound cells bound by a tint
— not any particular weight, colour, field or value, all of which are this
system's. Rule 2 was rewritten rather than patched, because the first pass had
banned the class band on grounds (separation) that turned out not to be the
band's actual job (per-class data).

**Pit Wall, 2026-08-18.** The near-square radii, the 13.5° shear as a system
device, the solid class band, the position block, the caps on CTAs (and, until
v1.11, on driver names), and the deepened neutrals were chosen from four directions drawn on a
design canvas and reviewed side by side against the shipped v1.8 UI. Nothing
was taken from an outside reference on this pass: the shear is the app's own
mark (§ The mark), and the rest is this system's tokens re-rationed. The
sections it rewrote — § Two colour systems rule 2, § Dense tabular overlays
rules 5 and 11, § The class band — were rewritten rather than patched, because
each had banned in principle the thing the direction turned out to need, and a
patch would have left the ban standing next to its exception.

**Strip rows, 2026-10-10.** Standings and Relative were restyled against a
screenshot of another timing overlay, supplied as the brief. Taken: each row
as its own strip with the class edge opening it; the class band and session
strip as strips of the same kind; licence and iRating as one two-segment pill;
the position as a plain number, briefly an arrow after a pass; `GAP` and `INT`
on the leader's row; ratings in full. The boundary is the one above — no
palette, typeface or token value came from it, and § Deliberately not adopted
lists what was left behind. The typeface did not come from it: Saira was
chosen afterwards, on its own tests (§ Typography). This pass retired two of
Pit Wall's choices, the
solid class band and the position block; § Two colour systems rule 2 says
why, and § Dense tabular overlays rules 1, 5, 11, 13 and 14 and § The class
band were rewritten with it. The tyre column's move to Relative, and its
`D`/`W` badge, came with the same brief (rule 15).

**Class fill, 2026-10-11.** The owner asked for these directly: car marks
drawn bolder and given room in their column, the class colour carried from
the edge to the position as a gradient, the Relative's tyre badge at the
brand mark's size, and each class's name in its class colour (driver names
were class-coloured first, and returned to white on review). No outside
reference. It takes back part of what the strip-rows pass retired — identity
colour behind the position — in a form that answers the reasons that pass
gave: faded rather than solid, and held by a test to what white digits need.
§ Two colour systems rules 1–3 and § Dense tabular overlays rules 5, 11, 13,
14 and 15, § The class band and § Deliberately not adopted were rewritten
with it. The class name's outline came with it as a consequence, not a
request: class-coloured ink on its own class's fill has no edge (a dark chip
did the job first, and went when the owner asked for no background).

**One type across the overlays, 2026-10-11.** Also at the owner's request:
Fuel & Strategy and every dashboard widget — on the overlay, in their own
windows and in the Manager's preview — are now set in Saira like the two
tables, mono micro-labels included, and nothing on the timing paper is
lighter than semibold. § Typography and § Dense tabular overlays rule 8 were
rewritten with it.

**Tyres back on Standings, 2026-10-11.** At the owner's request the tyre
column returns to Standings, with the Relative's `D`/`W` badge at the
Standings brand mark's height, and stays on Relative. It is a column toggle on
Standings (Manager → Columns) and the "Tyre compound" option on Relative, on
by default on both. § Dense tabular overlays rule 15 and the `--color-tyre-wet`
row of the theme table were rewritten with it.

**Session header, legible marks, ratings on Relative, 2026-10-11.** Three
asks from the owner, no outside reference: the session strip on Standings and
Relative to be a modern header and a row of its own rather than a strip that
read as the first row; the car marks whose letters could not be read
(McLaren's above all) to be fixed; and an option for iRating on Relative —
then, on review, without the projected change.
§ The session header was rewritten rather than patched — its first bullet was
the argument for the look being replaced — and § Typography's micro-label
note, § Dense tabular overlays' geometry and rule 5, § The class band and the
marks entry in § Deliberately not adopted with it.

**Race-engineer telemetry, 2026-10-14.** A complete visual refactor at the
owner's request, aesthetics only: no logic, store, hook, calculation, data key
or component signature changed. The brief was motorsport data-analysis
software and the pit wall — near-monochrome graphite, one accent, semantic
colour only where it means something, mono figures and sans-caps labels,
rectangular panels with thin headers and 1 px dividers, thin-line charts on a
dotted grid with a reduced palette, effects kept but held to 120–200 ms with no
bounce or glow, and class colour as the one functional exception, shown only
in multiclass sessions as a bar, a tag and a chart line. No outside reference;
the values are this system's. It retired the 13.5° shear on the chrome, Saira
and the bold-throughout overlays, the gradient class fill and class-coloured
names, the lit licence pill, the lit session header, the 8 px timing blocks,
the strip-per-row seam (rows now take a hairline), the tinted status blocks on
Fuel & Strategy and the Coach, the Manager's dot grid, and Endurance's copper
accent; it brought back a thin header on every widget. § Race-engineer
telemetry was added; § Theme, § Two colour systems, § Typography, § Motion,
§ CTA voice, § The mark rule 5, § What every surface MUST share, § Per-surface
allowances, § Dense tabular overlays rules 1, 5, 8–11, 13 and 15, § The class
band, § The session header, § Fuel & Strategy, § The Coach, § The Radar and
§ The marketing surface rule 3 were rewritten with it.

## Known follow-ups

- **Relative does not carry race control's flags yet.** Rule 19's marks are
  on Standings only. Relative's rows have the same name-then-radio slot, and
  a black flag on the car you are about to lap is arguably worth more there
  than anywhere; the marks are a component (`CarFlagMarks`) so it is one
  line when someone wants it.

- **A synced chart cursor with a tabular readout.** The brief asks for a
  vertical crosshair synced across charts, with a compact tabular readout. The
  only time-series chart today is the live input trace, and its cursor is
  "now", at the right edge, where each channel's current value is marked. A
  hover cursor would need new UI state and pointer handling — outside a
  look-only change — and it would be the first thing on an overlay that
  rewards aiming, against § Dense tabular overlays rule 7. It belongs with the
  first history chart (a lap-comparison trace in the Coach, say), where the
  reference lap would be `--color-chart-reference` and the current lap the
  accent.

- ~~**A timed race's length is estimated from the player's pace, not the
  leader's.**~~ **Done**, and more cheaply than this entry expected. The plan
  was to derive a leader average from the standings store; iRacing already
  publishes the answer on `SessionLapsRemainEx`, and the bridge was reading the
  plain `SessionLapsRemain` — which is the unlimited sentinel in exactly the
  timed races where the question matters. Preferring `…Ex`
  ([`parsing.py`](bridge/telemetrylab/parsing.py)) hands the fuel screen
  iRacing's own leader-derived prediction, so the estimate from the player's
  lap time is now only the fallback for a session that has not published one.
- **The dashboard's widget frames still carry two buttons each** — open in own
  window, and hide — revealed on hover in the panel header in
  [`Widget.tsx`](src/components/layout/Widget.tsx). They are the last thing on
  an overlay that can be aimed at, and § Dense tabular overlays rule 7 says
  they should not be there. They are not simply deletable the way the fuel
  screen's controls were: unlike a reserve percentage, "hide this widget" and
  "pop this one out" have no home in the Manager yet. Closing this means
  building that home first.
- **The site's tokens are a copy, not an import.** Deliberate (it buys a
  zero-build deploy) but it is a real fork: nothing enforces that
  `site/css/tokens.css` still matches `src/styles.css`. A check in CI that
  diffs the two colour blocks would close it.
- **Nothing re-shoots the site's captures automatically.** The script is in the
  repo ([`site/capture.mjs`](site/capture.mjs)) and takes one command, but a UI
  change still dates the screenshots silently until someone runs it. Wiring it
  into a release step would close that.

  The strip-per-row restyle and the tyre column's move to Relative shipped
  without one, and the page spent one release describing the old captures — a
  tyre column on Standings, "shape, not colour" for wets, fifteen columns.
  Re-shot for 1.15, with the copy and alt text changed in the same commit:
  the two have to move together, or the alt text describes a picture the page
  is not showing.
- **The class band could carry its own projected race distance.** The
  reference this restyle followed prints one per class (`6/≈35.80`): in a timed
  multi-class race a GT4 and an LMP1 cover different distances, and the session
  strip's single `LAP 14/≈25` is the player's. The band has the class leader's
  lap; it would need a per-class lap-time estimate the standings payload does
  not carry yet.

- **The widget header came back, thinner.** 1.10–1.24 cut it on the argument
  that a label already learned costs a glance every time it is skipped. The
  race-engineer brief puts a thin header on every panel, and it is now 22 px
  of small grey caps — the cheapest a channel name can be — that yields its
  height to the data on a card under 96 px tall. The whole card, header
  included, is still the drag target. Worth watching: if drivers ask for the
  pixels back, a Manager toggle per overlay is the honest answer, not a
  surface that differs from its preview.
- `--color-danger` and `--color-warning` have no `-dim` counterpart, so a
  filled destructive button has no hover fill. Not needed yet: destructive
  actions here are outline-at-rest.
- **The Relative's `gap` column colours cars behind with `danger`.** By the
  § Theme table that reads as *critical*, which a car three seconds back is not.
  It wants a token the palette does not have yet — "behind you" is neither
  positive nor a warning — so it is left alone rather than guessed at.
- **Rule 3 repeats the labels once per class group.** Correct by the rule — each
  group is its own small table — but in a two-class field the second label line
  sits ten rows below the first, which may be one more than it needs to be.
- ~~**Rule 7 cost the standings its class *names*.**~~ **Done** — by the class
  band of rule 2, which names the class and carries its numbers besides. An
  interim fix printed `GT3 · 6` in the leader row's `Driver` label slot; the
  band supersedes it, and the `Driver` label is back.
- **Per-class collapse and solo-filter are still gone**, and the band's return
  does not bring them back: rule 7 outranks rule 2, and per-class state is
  session data rather than configuration, so it has no home in the Manager
  either. Worth revisiting only if a large multi-class field actually proves
  unreadable without them.
- **The class band repeats no session-wide value**, unlike the reference, which
  reprints lap, clock and track temperature on every band. Those live once, on
  the session header. If a user ever runs the band without the header and misses
  them, the answer is to let the *strip* pin rather than to duplicate it per
  class.
- **The coach forgets its reference when the bridge restarts.** The reference
  lap and the corner map live in the bridge's memory, keyed by track, layout
  and car, so a new session on the same car and track starts from a fresh
  reference. Persisting the best clean lap per key to disk, and accepting an
  imported `.ibt` lap (pyirsdk's `IBT` reader) as the reference, are the two
  natural next steps. Corners are numbered `T1…Tn` in the order the coach
  found them, not by the track's official turn numbers — a per-track name
  map would fix that.
