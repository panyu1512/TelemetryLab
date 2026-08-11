# Design — TelemetryLab

A locked design system for this app. Every surface redesign reads this file
before emitting code. Do not regenerate it per screen — extend or amend it when
the system needs to grow.

Because this is one product rather than a set of pages, the usual "make each
page different" rule is **inverted**: surfaces must share the system. Variety
lives in what each surface *does*, not in its palette or its type.

## Genre

**modern-minimal** — the technical, instrument-panel end of it. Dark by
necessity: overlays are composited over live game footage, and the manager sits
on a second monitor at night.

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
- **Marketing surface: Split Studio.** One page, at [`site/`](site/), selling
  the app. Every claim is paired with the capture that proves it, and the
  pairing alternates down the page. See § The marketing surface.

## Theme

Custom (tuned), anchored on the palette this project already had — converted to
OKLCH so a token can be lifted to hit a contrast target without dragging its
hue. Values in [`tokens.css`](tokens.css); the live source is the `@theme` block
in [`src/styles.css`](src/styles.css).

Four runtime themes (Carbon, Midnight, Graphite, Endurance) vary the temperature
of the neutrals and the exact accent hues. **They never vary what a colour
means.**

| Token | Meaning | Never used for |
| --- | --- | --- |
| `--color-accent` | positive: personal best, faster, healthy | chrome, decoration |
| `--color-danger` | critical: slower, overheating, out of fuel | destructive-button chrome at rest |
| `--color-warning` | caution: pit soon, yellow flag, worn tyres | interactive affordances |
| `--color-primary` | interactive & informational: selection, links, **the player's own row** | telemetry values |
| `--color-sector-purple` | overall-best lap/sector | anything else |

Two rules that fall out of that table and are easy to break:

1. **`--color-on-accent` is the only text colour allowed on a filled status
   surface.** Every accent in this system is light and every paper is dark, so
   `white` on a filled accent measures 2.2–2.9:1. `on-accent` reads 6.5–8.7:1.
2. **A theme's `primary` must stay ≥30° in hue from its `warning`.** Endurance
   shipped them 8° apart, which made "you can click this" and "caution" the
   same colour.

## Two colour systems

The table above governs **status** — what the app has computed about a value.
There is a second, unrelated axis on the timing surfaces: **identity** — which
class a car is in, and which car is yours. Conflating the two is how a
standings table stops being readable at a glance.

1. **Identity colour is data, not a token.** `carClassColor`
   ([`src/telemetry/types.ts:99`](src/telemetry/types.ts)) is supplied by
   iRacing per class. It is arbitrary, it sits outside this palette, and it can
   land on any hue — including one that collides with `primary` or `danger`.
   Never add it to `tokens.css`, never give it a meaning from the status table,
   and never let a theme try to correct it.
2. **Identity colour is quarantined to the leading edge.** On a standings or
   relative row that carrier is the 3 px left border
   ([`StandingsRow.tsx`](src/components/standings/StandingsRow.tsx)); on a class
   band it is the band's own 3 px leading edge plus the chip that *is* the
   band's subject. Those are one device at two scales, not two carriers. It may
   not *additionally* tint a driver's name, fill a row, or colour a badge in a
   data cell — one carrier, or an arbitrary hue starts competing with the status
   colours sitting beside it in the same row.

   The chip is the single case where identity colour fills, and it takes the
   computed ink of § Dense tabular overlays rule 11 rather than `on-accent`,
   because a colour this palette does not own cannot be assumed light.
3. **"This is you" is `primary`, and it is the row's ground, not its ink.**
   `bg-primary/10` plus an inset `primary/35` ring. This is the "selection"
   sense of `primary` in the table above, which is why the token row now says
   so out loud. Tinting the *text* instead would put an identity colour and a
   status colour in the same glyph.

The obvious alternative — amber for your own car, as several timing overlays do
it — is banned here for the reason rule 2 of § Theme already gives: our
`warning` is amber. "That's you" and "pit soon" would be the same colour.

## Typography

- **Display and body: Inter** (`--font-sans`), weights 400/500/600. A
  single-family system — this genre allows it, and a second display face on a
  panel this dense would be noise.
- **Mono** (`--font-mono`) is the third voice, and it is *semantic*, not
  stylistic. It marks **instrument nomenclature**: measured values, coordinates,
  counts, protocol versions, log lines, channel labels, status readouts.
- Prose — descriptions, hints, help text — is always sans. If a string is a
  sentence someone reads, it is sans. If it is a value or the name of a
  channel, it is mono.
- Numerals in any column or ticking value carry `.tnum`.
- Micro-labels are mono, uppercase, `tracking-[0.12em]`–`[0.14em]`, `text-faint`.
- **Headings are roman.** No italic display type anywhere.

## Spacing

Tailwind's default 4-point scale. Named equivalents are exported in
`tokens.css` for portability; the app uses the utilities.

## Motion

- Easings: `--ease-out` `cubic-bezier(0.16, 1, 0.3, 1)`, plus `--ease-in` and
  `--ease-in-out`. These override Tailwind's transition defaults, so a bare
  `transition-colors` inherits the curve without restating it.
- Durations: `--dur-instant` 80 ms, `--dur-short` 140 ms, `--dur-mid` 220 ms.
- Animate `transform` and `opacity` only. Never layout properties.
- No overshoot or bounce on UI state.
- Reveal pattern: **none.** The manager fades in once on mount (`manager-in`).
  Nothing animates on scroll.
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

- Primary: `bg-primary` fill + `text-on-accent`, `--radius-ctl` (6 px), label
  is a verb phrase, always `whitespace-nowrap`.
- Secondary: `bg-surface-2` + 1 px `--color-border`, same geometry.
- Destructive: secondary geometry; `danger` arrives only on hover, never at
  rest.

## The mark

A **TL monogram**, sheared 13.5° off vertical, every free terminal cut on the
same diagonal. It is the only drawn symbol in the system — everything else on
every surface is type, rule or data.

The geometry is a construction, not a drawing, and it is written out in the
header of [`public/favicon.svg`](public/favicon.svg) so it can be rebuilt rather
than traced: both letters upright on a 32 grid, cap line 8, baseline 25, stroke
5, then sheared 0.24 x per unit of height about the baseline. Two decisions in
there are load-bearing — the T's stem hangs at **75 % along its crossbar**
rather than the middle, without which the pair reads as a pi; and the L starts
**3 above the cap line** with its foot running 10.5 right, which is what makes
the letters interlock across the 2.8 channel instead of standing side by side.

Four rules:

1. **One shape, one colour.** The mark never uses two. It takes `primary` on
   chrome — the nav, the title bar — because the name beside it is already
   white and a white mark against white text is a ligature, not a mark. It
   takes white on the icon plate, where it is ink on paper and the status
   table does not apply. It never takes `accent`: the mark it replaced filled
   its counter with `accent`, which by § Theme means *positive* and is never
   decoration.
2. **The plate is for icons only.** A 7-radius square of the timing surfaces'
   near-black (`#0a0d12`), because an OS icon has to bring its own ground. In
   the nav and the title bar the mark is bare — those surfaces have paper
   already.
3. **The ink fills 62.5 % of the box**, so the box is sized about a fifth
   larger than the cap height it sits beside — 1.45em against the site's
   wordmark, 18 px against the title bar's 13 px name. Sizing the box to the
   cap height sets the mark visibly short.
4. **It is always `aria-hidden`.** The product name is next to it in every
   place it appears.

`public/favicon.svg` is the source. The platform icons in `src-tauri/icons` are
generated from it with `npm run tauri icon public/favicon.svg`;
`site/favicon.svg` is a copy for the same reason the site's tokens are one; and
the nav and title bar inline the two paths so they can take `currentColor`.
**Four places, one geometry** — change the mark and change all four.

## What every surface MUST share

- The token names (not the values — those move per theme).
- The colour *meanings* in the table above.
- Inter + mono, with mono reserved for instrument nomenclature.
- The mark, and the four rules under § The mark.
- The control contract and the 8 states.
- 6 px controls / 10 px cards / 12 px panels.
- `.tnum` on every column of numbers.

## What surfaces MAY differ on

- Presence of the preview pane (Workbench with or without it).
- Density — an overlay over game footage is tighter than the manager.
- Which status colours appear at all; most surfaces use none.

## Per-surface allowances

- **Manager chrome** speaks the instrument voice: mono channel labels, the
  fading `.header-rule` as section divider, the three-state sidebar rail.
- **Overlay widgets** are legibility-first over footage: `.timing-surface`
  paper (§ Dense tabular overlays rule 9), text-shadow, no scrollbars, no
  frame. They must never gain manager chrome.
- **No *app* surface uses enrichment.** No hero imagery, no illustration, no
  decorative background beyond the existing `.bg-blueprint` dot grid on manager
  chrome. Function carries every screen. The marketing surface is the one place
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
in [`constants.ts`](src/components/standings/constants.ts): `ROW_H` 32 px, and
— the two the rules below buy back — `COL_LABEL_H` 10 and `CLASS_GAP` 10, plus
`STRIP_H` 26 when the § Session strip is on. Every rule below is downstream of
the fact that a header band and a row cost the same height.

1. **No vertical rules, no row separators.** Separation is alignment and
   whitespace; zebra tint is the only banding allowed. At 32 px a rule costs
   more attention than it returns. The one hairline permitted is the session
   strip's baseline, which separates the readout from the field rather than one
   row from the next.
2. **Class separation is a gap plus a tone shift — and, on Standings, a band
   that earns its height by carrying the class's own numbers.** The gap and the
   tone shift do the separating; they read pre-attentively and cost a third of
   a band. What the earlier absolutist version of this rule got wrong is that
   separation was never the only job. A class's **car count, strength of field
   and fastest lap** are per-class and per-group: the session strip cannot hold
   them (it is field-wide) and no row can (it is one car). The band is the only
   place they exist, and a band that is *carrying data* is not the labelled
   band this rule was written against.

   `CLASS_BAND_H` is 26, not the 34 the old class header cost, because it is a
   strip's geometry — a chip plus micro-label/value pairs — rather than a row's.
   It is subject to rule 7 like everything else: no collapse, no solo, nothing
   to click. It appears only when the field is grouped by class (a flat table
   has one group and nothing to name), and it can be switched off from the
   Manager.
3. **Column labels are off by default, and when on they print in the top slice
   of the first row**, out of flow, so they cost no height at all. A persistent
   28 px band was 13 % of a ~208 px six-row Relative spent on labels a returning
   user stopped reading in their first session; the host row clears the
   in-flow version with `COL_LABEL_H` of top padding instead of centring under
   them.

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
5. **Fill is rationed to one meaning per surface; tint is not fill.** A *fill*
   is opaque and takes contrasting ink, and it is the loudest tool on this
   surface — on Standings it is spent on fastest-lap-in-class and nothing else.
   Filled cells obey `on-accent` (§ Theme, rule 1), with the one exception in
   rule 11.

   A **tint** is a different device: the same hue as its ink, at ≤ 18 % alpha,
   behind that ink. It does not compete with a fill for attention; it *binds a
   compound cell into one token* so the eye takes it as a single thing. The
   licence badge (`A3.45`), the iRating pair (`3.7k ▲29`) and the
   position-change chip (`▲8`) are tints — each is two values that are read
   together or not at all. `tint()` lives in
   [`lib/contrast.ts`](src/lib/contrast.ts).

   **A tinted chip in a column is sized by the column, not by its contents.**
   `3.7k ▲29` and `1.9k` hugging their own text are two different widths in the
   same column, which turns a quiet grouping device into a ragged edge down the
   table — and puts the values themselves on different verticals, which is the
   one thing a column of numbers may never do. The chip fills the cell and the
   delta gets a fixed-width slot.

   The test for whether something may be tinted is rule 4's test: if it would
   otherwise want to be two columns, it is a compound cell and a tint is
   allowed. If it is one value, it gets coloured text and nothing else.
6. **The name column is `minmax(0, 1fr)` and truncates last.** Every other
   column is fixed-width and mono; the name absorbs all slack. A layout that
   clips `Francois Sieg…` while fixed columns hold empty space has its
   priorities backwards.
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
   allowed above the rows**: the § Session strip below, the per-class band in
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

8. **Type on these two surfaces runs one step larger and one weight heavier
   than anywhere else in the app.** 13 px semibold names, 12 px semibold values,
   14 px bold positions, on `ROW_H` 32 (Standings) / 34 (Relative). Every other
   surface in this system is read by someone looking *at* it; these are read in
   peripheral vision at 200 km/h by someone who must not look away for long.
   The density lost to the extra pixels is bought back by rules 2, 3 and 7,
   which is what those rules are for.

9. **They paint on their own near-black paper**, `--color-timing-bg`, not the
   app's `surface` graphite, and they keep it opaque over live footage instead
   of dropping to glass. A 32 px row of 12 px type cannot afford to let a
   sunlit kerb through. The token carries the active theme's hue so the surface
   stays part of the system, and the zebra banding on top of it is plain white
   alpha (`GROUP_TONE`) so the banding device means the same thing in all four
   themes.

   **This paper is no longer only theirs.** It was, on the argument that a
   gauge can afford a kerb showing through where a table cannot — but that
   argument was about legibility, and a fuel figure read mid-corner needs the
   ground as much as a lap time does. Fuel & Strategy and every dashboard
   widget now carry `.timing-surface` too, in the overlay, in its own window
   and in the Manager's preview. What is left on glass is the frame around
   them, which carries no data. A dashboard where half the cards were paper and
   half were glass read as two products.

10. **A lap that grades is ruled, not recoloured.** The last-lap cell keeps
    white digits and takes a 2 px underline in `accent` (personal best) or
    `sector-purple` (session best). The last lap is the number a driver is
    actually comparing against the car ahead, so it has to stay readable *as a
    time* first; grading it by recolouring the digits trades legibility for the
    grade, and the underline carries the same information in the same glyph box
    at no cost. `sector-purple` still colours the digits themselves, because a
    session-best lap is an event rather than a comparison.

11. **Class colour picks its own ink.** § Theme rule 1 makes `on-accent` the
    only ink allowed on a filled status colour, and that holds because every
    status colour in this palette is light by construction. `carClassColor` is
    not in this palette and is not light by construction — a class can land on
    a navy that dark ink vanishes into. So the class chip on the band measures
    the fill's WCAG luminance and picks dark or white
    ([`lib/contrast.ts`](src/lib/contrast.ts)). This is the *only* place in the
    app where ink on a fill is computed rather than declared, and it is
    permitted for exactly the reason that makes identity colour a separate
    system in the first place: the palette does not own it.

### The class band

One line opening each class group on Standings:
`[GT3] · CARS 6 · SOF 4.1k · BEST 2:06.652`.

- **The chip is the band's subject**, so identity colour is allowed to fill it
  here — with ink chosen by rule 11. The band's 3 px leading edge takes the
  same colour, which is the row's own left border one scale up rather than a
  second carrier (§ Two colour systems, rule 2).
- **`BEST` turns `sector-purple`** when that class's fastest lap is also the
  session's, which is the same meaning purple carries in every row.
- **It is a heading, so it is set apart from its group, not flush against it.**
  `CLASS_BAND_H` 30 plus `BAND_GAP` 4: a band sitting directly on the first row
  reads as that group's first entry rather than as the thing that opens it. Its
  leading edge sits on the same vertical as the rows' left borders — same
  device, same x — so the band and the field share one left margin.
- **It borrows the session strip's grammar** — chip, then micro-label/value
  pairs — so a multi-class field reads as one masthead and several
  sub-mastheads, not two unrelated kinds of furniture. Fields drop
  right-to-left as the overlay narrows, as everything else on these surfaces
  does; the chip is the last to go, because a band that has clipped its own
  name has stopped doing its job.

### The session strip

One line above the field, on both timing surfaces:
`RACE · LAP 6/≈36 · LEFT 50:24 · INC 4x · TRK 38° · SOF 3.3k · AIR 22° · CLK 20:46`.

- **Every field is a mono micro-label plus a bold value.** This is the
  § Deliberately not adopted note on icon-only strips, cashed in: a thermometer
  glyph the user has to *learn* is not a readout, it is a quiz.
- **The session tag is the strip's only fill**, and the active flag is what
  fills it — flag state is the one thing here that changes what the driver does
  next. Filled ink obeys § Theme rule 1. Flag colour comes from the *status*
  table, not from the marshal's flag: a black flag is `danger`, because black on
  black is nothing.
- **The lap field projects a distance for a timed race** (`6/≈36`, from time
  remaining ÷ estimated lap) rather than showing a bare lap counter. "Am I on
  the last lap" is a fuel and tyre decision, and a timed race never publishes
  an answer.
- **Fields drop right-to-left as the overlay narrows**, in priority order, the
  same way `fitColumns` narrows the table. The last field standing is the lap.

### Deliberately not adopted

Two things the reference does that this system rejects, recorded so a future
pass doesn't "fix" their absence:

- **A Relative with *no way* to see column labels.** Rule 3 now defaults them
  off, which is not the same thing: they are a toggle away, so a first run where
  `2.2`, `A3.6` and `3.9k` are undecodable is still recoverable. Removing the
  labels from the codebase, rather than from the default, is the thing that
  stays rejected.
- **Low-contrast car numbers.** `#30` in a near-`faint` grey fails the `faint`
  floor. Car number is `muted` at minimum.

Two things this section previously rejected have since flipped, and it is worth
being explicit about *why* each turned, so the next pass reverses them only for
a better reason than the last one:

- **Manufacturer marks** were drawn at 13 px in 55 % grey, on the theory that
  identity should stay quiet next to the status colours. At that size an Audi's
  four rings and a Porsche crest resolved to the same smudge in peripheral
  vision, which is the one place this surface is actually read. Now 17 px in
  near-white. This does not re-open § Two colour systems rule 2 — the mark is
  drawn in the row's own ink.
- **The class band** was rejected on the grounds that a gap separates classes
  for a third of the height. True, and irrelevant: separation was never the
  band's job. See rule 2.

The rejections that stand are both about *withholding information the reader
needs*, which is the pattern worth noticing — a rule that only removes chrome
is a rule that will keep getting revisited.

## The marketing surface

One page at [`site/`](site/): static HTML and three stylesheets, no build step, no
framework, deployable as a folder. It is a **third surface class**, and the
sharing rule at the top of this file governs it exactly as it governs the other
two — a page selling an instrument that does not look like the instrument is
selling something else.

**Macrostructure: Split Studio.** Every claim sits beside the capture that
proves it, and the pairing alternates direction. Nav is **N9 edge-aligned**
(wordmark hard-left, actions hard-right, nothing between); footer is **Ft5
statement** — a closing line, not a sitemap. The closing line is the wordmark
itself, and rule 5 below is what it is allowed to do.

What it inherits without change: every colour token and every colour *meaning*,
Inter, the 4-point spacing scale, the three easings and durations, the 8-state
control contract, the focus-ring rule, and § Motion's reveal pattern of **none**
— a marketing page that animates on scroll would be the first surface in this
system to do so, and it does not get to be.

Five things it is allowed that no app surface is:

1. **A display type scale.** `--text-display` and friends exist only here. The
   app is read at a glance at 200 km/h and has no use for 4.6rem type; a page
   read at arm's length needs it.
2. **Real product captures.** They are proof, not enrichment: every claim on the
   page is verifiable in the image next to it. They are wrapped in a bare
   `<figure>` with a hairline border on `--color-timing-bg`, so a screenshot
   sits on the paper it was shot on. **No drawn browser chrome** — no URL pill,
   no traffic lights, no phone frame. A fake window only ever reads as fake.
3. **A pinned mono.** The app resolves `--font-mono` to the OS default because
   it ships inside a WebView whose stack is known; a public page has no such
   guarantee, and the mono is what makes the site read as the product rather
   than as a page about it. The site pins JetBrains Mono.
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

Two rules it does *not* get to break:

- **Honest copy.** No invented metric, download count, testimonial or logo wall.
  Everything the page asserts is either visible in a capture on the page or is a
  plain fact about how the software runs.
- **No hanging headers.** A heading parked in a left column with its body in a
  right one is banned here as it is everywhere else in this system. Section
  heads stack.

## Provenance

The § Dense tabular overlays rules were extracted on 2026-08-08 via
`hallmark study` (image mode) from published screenshots of a third-party
timing overlay, as a public reference. What was taken is structural — row
grammar, where labels live, how colour is rationed. No palette, no typeface, no
markup, and no token value came from the source; every rule above is expressed
in this system's own tokens. Colour values here remain those of the four
runtime themes.

Rules 8–11, the § Session strip and the § Class band were added on 2026-08-08
across two further passes over the same reference, after this app's surfaces
were read against it side by side. The same boundary holds throughout: what was
taken is *that* a timing overlay wants heavier type on darker paper, a readout
line of session state, per-class mastheads, and compound cells bound by a tint
— not any particular weight, colour, field or value, all of which are this
system's. Rule 2 was rewritten rather than patched, because the first pass had
banned the class band on grounds (separation) that turned out not to be the
band's actual job (per-class data).

## Known follow-ups

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
  window, and hide — revealed on hover in
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

- The overlay widgets' own header labels are still sans; they were deliberately
  left out of the Manager redesign so the preview keeps showing overlays
  exactly as they render over the game. Aligning them to the mono nomenclature
  rule is a separate change that should be verified against real footage.
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
  the session strip. If a user ever runs the band without the strip and misses
  them, the answer is to let the *strip* pin rather than to duplicate it per
  class.
