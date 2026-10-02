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
  named exception to the header rule; see § Dense tabular overlays. Standings
  is drawn as **the timing tower** (§ The timing tower), and the **Broadcast**
  overlay is that tower cut down for a stream.
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

**One surface opts out of them: the timing tower** — the Standings screen and
its Broadcast cut-down. It carries one fixed palette of its own
([`lib/towerPalette.ts`](src/lib/towerPalette.ts)), because it was designed,
reviewed and contrast-checked as that palette, and letting four themes re-tint
it would put back exactly the variations it was measured without. The themes
still govern the Manager, the Relative, Fuel & Strategy and the widgets. See
§ The timing tower, rule 2.

The neutrals sit a step deeper than a graphite panel would want, and
`border-strong` a step lighter, because this surface carries **solid** colour
blocks: a block only reads as a block against a ground darker than itself, and
at 2 px radii the 1 px edge is what draws a control's shape, so it has to be
visible on its own. `--color-timing-bg` follows at 68 % of `bg` toward black
rather than 30 % — the ground under the field is no longer the only thing
separating one class group from the next.

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

1. **Identity colour is ours, chosen against the status hues.** It used to be
   `carClassColor`, taken from iRacing as given, on the principle that identity
   is data rather than a token. That principle produced the collision it was
   meant to describe: the sim's stock GT3 colour is `#ff4d4d`, this app spends
   red on lapped traffic, and a red-edged row next to a red-grounded row is two
   unrelated statements in one hue. At four or five classes some class landing
   on red, on the blue that means "this is you", or on the amber that means
   "pit" stops being a risk and becomes an expectation.

   So the five class colours now come from
   [`lib/classColors.ts`](src/lib/classColors.ts), spaced against every status
   hue in all four themes: `danger` 24–28, `primary` 253–257 (and 45 in
   Endurance), `warning` 81–82, `accent` 154–157, `sectorPurple` 295–302. Every
   entry clears its nearest reserved hue by at least 25°, and consecutive
   entries — which colour consecutive class groups down the screen — sit more
   than 100° apart, so neighbouring groups can never blur into one another.

   One exception is deliberate: **violet sits 3° from `sectorPurple`.** Nothing
   fits between `primary` at 255 and `sectorPurple` at 300, and this is the
   cheapest collision available — `sectorPurple` is ink on a single lap time,
   transient and rare, where identity is a row's leading edge and its ground.
   Different carrier, different place, never the same cell.

   `carClassColor` is still on the wire and still unused for display. Do not
   add it to `tokens.css`, and do not let a theme try to correct it.

   **The ramp is the default, not the last word.** Since the timing tower
   (2026-09-27) a driver can pick a colour per class in the Overlay Manager,
   keyed by the class's short name so a GT3 made orange stays orange wherever
   it sorts next week. A pick is measured against the hues the tower spends on
   a status (`classColorClash`, within 20° of OKLCH hue) and **warned about,
   not refused**: a league whose GT3s have been orange for five seasons knows
   its own field better than the ramp does. The Relative and the Broadcast
   overlay take the same picks.
2. **Identity colour marks a class in two places on each surface, and they
   are different places on the two surfaces.**

   On **the timing tower** (Standings) it is the **class chip** in the header
   of each class card, and the **position block** that starts every row in it —
   the same block of colour at heading size and at row size. Rank and class are
   the two facts taken off a row without reading it, and the block is the one
   cell where they are a single glance. Rows carry no class edge and no class
   ground any more: each class sits in a card of its own, so a stripe or a
   tint behind rows already grouped by class would say the same thing twice.

   This rewrites the Pit Wall rule of 2026-08-18, under which Standings ran the
   class colour in as a 4 px edge, a 16 % fill to the end of the first column,
   and a solid band heading each group. What retired it is the design canvas of
   2026-09-27 (§ Provenance): with the groups drawn as cards, the band's job —
   "this block of rows is one class" — is done by the card's edge, and the
   colour could be spent where the eye lands first instead of spread along an
   edge it has to find. The band's solid fill is gone with it; the header is
   quiet paper, and its chip is the class's one heading-size block.

   On **the Relative**, which has no groups to put in cards, identity is still
   the **leading edge** (`CLASS_EDGE_WIDTH`, 4 px, held at its drawn size as the
   table scales) and a **14 % wash** across the row (`classTint`). Its rows are
   sorted by where cars physically are, so two neighbours of the same class
   rarely sit together and there is no run of rows for a card to hold.

   **A row wears exactly one ground.** Where a status ground applies — the
   player's, a lapped car's on the Relative — the class ground gives way to it
   entirely. On the tower the only grounds a row can wear are the zebra and the
   player's, so identity and status never meet in a row's background at all.

   **Ink on identity colour is measured, never declared** — see § Dense tabular
   overlays rule 11: a class colour is now the driver's to pick, and a navy
   needs white ink where a lime needs dark.
3. **"This is you" is blue, and it is the row's ground, not its ink.** On the
   Relative, `bg-primary/10` plus an inset `primary/35` ring — the "selection"
   sense of `primary` in the table above, which is why the token row says so
   out loud. On the tower, the palette's own `meBg` ground and `meRing` blue
   ring: the same statement in the tower's colours. Tinting the *text* instead
   would put an identity colour and a status colour in the same glyph.

The obvious alternative — amber for your own car, as several timing overlays do
it — is banned here for the reason rule 2 of § Theme already gives: our
`warning` is amber. "That's you" and "pit soon" would be the same colour. That
is the same argument rule 1 now makes about class colour, arrived at from the
other direction.

## Typography

- **Display and body: Inter** (`--font-sans`), weights 400/500/600/700. A
  single-family system — this genre allows it, and a second display face on a
  panel this dense would be noise. 700 is reserved: CTAs, headings, and the
  values on the timing surfaces.
- **Mono** (`--font-mono`) is the third voice, and it is *semantic*, not
  stylistic. It marks **instrument nomenclature**: measured values, coordinates,
  counts, protocol versions, log lines, channel labels, status readouts.
- Prose — descriptions, hints, help text — is always sans. If a string is a
  sentence someone reads, it is sans. If it is a value or the name of a
  channel, it is mono.
- Numerals in any column or ticking value carry `.tnum`.
- Micro-labels are mono, uppercase, `tracking-[0.12em]`–`[0.14em]`, `text-faint`.
- **Headings are roman.** No italic display type anywhere.
- **The timing tower is the one app surface set in other faces**: **Barlow**
  for every number and label on it, **Barlow Condensed** for positions, names
  and badges — the design canvas's type, bundled with the app
  (`@fontsource/barlow*`) because the overlays run offline, over the game.
  Mono does not appear on the tower; its labels are Barlow caps, tracked
  `0.1em`. Everything else — the Manager, the Relative, the widgets — stays on
  Inter and mono. See § The timing tower, rule 3.
- **Caps are structural, not emphatic.** Three things are set in capitals and
  nothing else is: mono micro-labels, section and page headings, and CTAs
  (§ CTA voice). The driver-name column on both timing surfaces is the one
  data field in caps, and it is there to hold a single optical weight down the
  only ragged column on the surface. It costs something real — caps are read by
  outline, lose the ascender/descender silhouette that makes a name
  recognisable at a glance, and run ~12 % wider, so the one column allowed to
  truncate truncates sooner. Nothing else earns that trade.

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
- **Every variant is cut on `--shear` and set in caps** — 11 px, bold,
  `tracking-[0.06em]`. Caps carry no descenders and read a size larger than
  they measure, so the label keeps the row's height while gaining the weight
  the cut asks for. See § The mark rule 5 for where the cut may and may not go.

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
5. **The 13.5° shear is a system device, and it stops at the edge of the
   data.** `--shear` and the `.shear` pair in
   [`src/styles.css`](src/styles.css) put the mark's own cut on the app's
   chrome: the title bar's status readout, the profile chip, the section
   legends, every CTA. The timing tables, the widgets and anything drawn over
   the game never take it.

   The boundary is not taste. A driver reading a lap time in peripheral vision
   needs the column edges vertical, and a surface where half the boxes lean is
   a surface where nothing lines up. So the frame is cut and the instruments
   are square.

   The pair is an outer skew and a counter-skew on its single child, so the
   *box* is a parallelogram and the type inside stays upright — a sheared
   letterform is a different typeface, not a graphic device. Anything sheared
   needs ~0.24 × its own height of horizontal clearance, or its corners graze
   a neighbour.

`public/favicon.svg` is the source. The platform icons in `src-tauri/icons` are
generated from it with `npm run tauri icon public/favicon.svg`;
`site/favicon.svg` is a copy for the same reason the site's tokens are one; and
the nav and title bar inline the two paths so they can take `currentColor`.
**Four places, one geometry** — change the mark and change all four.

## What every surface MUST share

- The token names (not the values — those move per theme). The timing tower
  is the one exception: it has its own fixed palette (§ The timing tower).
- The colour *meanings* in the table above.
- Inter + mono, with mono reserved for instrument nomenclature — except on the
  timing tower, which is Barlow (§ Typography).
- The mark, and the four rules under § The mark.
- The control contract and the 8 states.
- 2 px radii throughout — controls, cards and panels alike. The timing tower
  keeps the canvas's own: 8 px on its cards and bar, 4 px on its chips.
- `.tnum` on every column of numbers.

## What surfaces MAY differ on

- Presence of the preview pane (Workbench with or without it).
- Density — an overlay over game footage is tighter than the manager.
- Which status colours appear at all; most surfaces use none.

## Per-surface allowances

- **Manager chrome** speaks the instrument voice: mono channel labels, the
  `.section-block` legend on the shear, the three-state sidebar rail, and the
  shear on its chips and CTAs (§ The mark rule 5).
- **The timing tower** (Standings, and the Broadcast overlay) has its own
  palette, faces and radii, and its own rules — § The timing tower.
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
read at a glance while the user is doing something else. Standings is now the
timing tower, and its geometry is the design canvas's, in canvas pixels, in
[`constants.ts`](src/components/standings/constants.ts): `ROW_H` 44,
`CLASS_BAND_H` 48, `LABEL_ROW_H` 28, `CARD_GAP` 12, `BAR_H` 48 — drawn at
whatever fraction of that the window allows, which at the widths people give a
standings window comes out close to the old 32 px row. The Relative keeps its
own: `ROW_H` 34 and the § Session strip's `STRIP_H` 26. Every rule below is
downstream of the fact that a header and a row cost the same height; where a
rule reads differently on the tower, it says so, and § The timing tower holds
the tower's own.

1. **No vertical rules. One row separator, on the tower: a hairline after
   every third row.** Otherwise separation is alignment and whitespace, and
   zebra is the banding — a step stronger on the tower than it was, because a
   long field read sideways loses its line without it.

   The every-third hairline is a *counting* device, not a separator, and that
   is why it survives a rule that bans separators. It does not say "these rows
   are different", which is what a rule under every row says and what cost
   more attention than it returned at 32 px. It says "that was three": the eye
   takes P1–P3, P4–P6 in threes down a thirty-car field instead of counting
   rows. The Relative has no separators — six rows either side of the player
   do not need counting — and its one hairline is still the session strip's
   baseline.
2. **On the tower, each class is a card.** A header, an optional label row,
   the class's rows, and 12 px of paper before the next card. The card's edge
   and the paper between cards do the separating; the header earns its height
   by carrying the **class's own numbers** — car count, strength of field,
   fastest lap and who set it — which are per-class and per-group, so the
   race-control bar cannot hold them and no row can.

   It used to be a gap plus a tone shift, then a solid band of the class's
   colour; the history is § The class header's. What the card changed is who
   does the grouping: an edge that closes round the group rather than a
   masthead that only opens it, so the group reads as one object in
   peripheral vision without the class colour having to be the thing that
   draws it.

   The header is subject to rule 7 like everything else: no collapse, no solo,
   nothing to click. It appears only when the field is grouped by class (a flat
   table is one card, and a header over the whole field would name something
   the reader can already see), and it can be switched off from the Manager.
3. **Column labels are off by default.** On the Relative, when on, they print
   in the top slice of the first row, out of flow, so they cost no height at
   all — a persistent 28 px band was 13 % of a ~208 px six-row Relative spent on
   labels a returning user stopped reading in their first session. On the
   tower, when on, they are a row of their own under each class header
   (`LABEL_ROW_H` 28, on the label-row paper), because that is how the design
   canvas draws them and a tower is tall enough to afford one.

   The default flipped to *off* because "costs no height" was answering the
   wrong objection. The cost of a label a driver has already learned is not
   pixels, it is the glance spent skipping it — and on the one surface read
   without looking, that is the expensive kind. Learnable once and then
   dismissable beats permanent: the labels stay one Manager toggle away, which
   is what keeps this from being the § Deliberately not adopted case of a
   Relative that is undecodable on a first run.
4. **Compound cells over extra columns.** A value and its delta are one cell in
   two voices — the value quiet, the delta in the colour of its direction — not
   two columns. iRating + its change is the canonical case. On the tower the
   two voices sit in two fixed, right-aligned slots with no tint behind them:
   the tint's job, binding the pair into one token, is done by the alignment,
   and a quiet column should not also be a chip.
5. **Fill is rationed by meaning, not by count; tint is not fill.** A *fill*
   is opaque and takes contrasting ink, and it is the loudest tool on these
   surfaces. The tower spends it on exactly these, and each is a heading or the
   statement the row most needs to make:

   - **identity, as a heading** — the class chip and the position block, both
     in measured ink (rule 11);
   - **the grade that matters most** — the fastest lap in class, wherever it
     appears (the best-lap cell, a sector, the class header's BEST LAP), in
     the class-best violet;
   - **a state that changes how the row is read** — the PIT badge (the row's
     live timing is greyed behind it) and the DSQ block (the row is no longer a
     position);
   - **race control** — the bar's badge, and under a yellow or a caution the
     bar's whole ground (§ The timing tower, rule 9).

   This is more than the three fills the Pit Wall version allowed, and the
   difference is deliberate rather than drift: that version rationed fill to
   one computed status per surface, which left the canvas's PIT badge, its
   DSQ block and its violet sectors with nowhere to go. The test survives — a
   fill is a heading or the single most important thing the row says, never
   a number that merely reports.

   A **tint** is a different device: the same hue as its ink, at a whisper,
   behind that ink. It groups a compound cell or marks a chip without
   competing with a fill. On the tower that is the licence badge, a personal
   best (green tint, with a hairline ring of its own so it is a different
   *shape* from the violet fill), the state chips beside a name, and a battle.

   The battle breaks the old test that "one value gets coloured text and
   nothing else", and it breaks it on purpose. It is not a grade of the value;
   it is the only statement on the surface about two rows at once — this car
   is within a second of that one — and a coloured digit is not enough to find
   it from the corner of the eye. It is kept honest by being rare and by its
   glyph (§ The timing tower, rule 7).

   **A tinted chip in a column is sized by the column, not by its contents**,
   and every value in a column takes the same padding whether it wears a chip
   or not — otherwise the chip's padding pushes one value's decimals off the
   column's vertical, which is the one thing a column of numbers may never do.
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
   widths, the § Session strip above them. The layout tuned at full size is the
   same layout at half. It is `zoom` rather than `transform: scale()`, which
   matters here more than most places: a transform resamples what it scales and
   softens 12 px tabular digits at exactly the sizes where they are already
   hard, where `zoom` re-lays the text out and keeps it hinted.
   `lib/tableScale` owns the factor and is the only definition of what being
   scaled means.

   The scale never exceeds 1 — a wide overlay is a table with room around it,
   not a table blown up — and stops at `MIN_TABLE_SCALE`, below which the
   surface goes back to scrolling sideways. That floor is a backstop against a
   table dragged to a sliver, not a claim about legibility; rule 8 is the claim
   about legibility, and scaling is in tension with it by construction. What
   settles the tension is who is choosing: the driver sizing the window is
   making the call knowingly, where a column vanishing was the app making it
   for them, silently.

   **Two things do not scale.** On the Relative, the class-colour edge divides
   the factor back out and holds its drawn size, because it went to 3 px, then
   4, precisely to stop disappearing in peripheral vision — see
   `CLASS_EDGE_WIDTH`. (The tower has no edge to hold.) And the bars and class
   headers are handed the width they have to draw *in* rather than the
   window's, so they keep every field at the sizes this rule exists to keep
   them at. What holds its size is what carries presence rather than quantity.

   **The floor is per surface.** The tower's natural width is the canvas's,
   about 1 460 px with every column on, where the old table's was about 1 030;
   the same *absolute* backstop is therefore a lower factor for it
   (`TOWER_MIN_SCALE` 0.35 against the Relative's 0.5). And the standings window
   now opens at 1100 × 560 rather than the generic 640 × 420, which is what
   shows the demo field at three-quarters rather than at under half.
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
   allowed above the rows**: the § Session strip below (on the tower, the
   race-control bar), the class header in rule 2, and the fuel screen's `MARGIN 1.0 lap`. None has a button or rewards a
   click, and the first two are Manager toggles, so they cost the driver
   nothing to ignore.

   **The design canvas proposed two controls on the tower, and only one came
   across, into the Manager.** Its class header carried a gap switch (to the
   class leader / to the car ahead) and a collapse arrow. The gap switch is a
   configuration — it changes what a column measures, for good — so it lives
   in the Manager, where it swaps the two gap columns rather than printing the
   interval twice. Collapse is per-session state, not configuration, so it has
   no home in the Manager either, and it stays out (§ Known follow-ups).

   **Fuel & Strategy came under this rule late.** It shipped with a reserve
   stepper, a pit-fuel override and a collapsed "Pit strategies" section, which
   made it the one overlay that asked the driver to aim at something — and the
   disclosure was the worst of the three, trading a glance for a click on a
   surface read at speed. All three are gone; the plans are always open. Their
   two settings sit at defaults taken from the sim (a 1.0-lap margin, pit fuel
   as needed — see § Fuel, in the sim's units), and by the sentence above,
   either one may come back only in the Manager.

8. **Type on these two surfaces runs larger and heavier than anywhere else in
   the app, and on the tower it is ranked.** Every other surface in this system
   is read by someone looking *at* it; these are read in peripheral vision at
   200 km/h by someone who must not look away for long.

   The Relative is flat: 13 px semibold names, 12 px semibold values, 14 px
   bold positions on `ROW_H` 34. The tower is a **hierarchy**, in canvas pixels
   on `ROW_H` 44 — position 22 px bold condensed in its block, name 21 px bold
   condensed, then the primary gap at 16 px regular in full ink, the other
   times at 15 px in secondary ink, and the quiet columns (car number,
   iRating, laps on the set) at 14 px in tertiary. The eye reads **position →
   name → gap** before anything else, because that is the order the question
   "who is where, and how far" is asked in; everything after the gap is read
   only when looked for. See § The timing tower, rule 3.

9. **They paint on their own near-black paper** — the Relative on
   `--color-timing-bg`, the tower on its palette's `#07090B` — not the app's
   `surface` graphite, and they keep it opaque over live footage instead of
   dropping to glass. A 32 px row of 12 px type cannot afford to let a
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
    its digits' ink and takes a 2 px underline — on the Relative in `accent`
    (personal best) or `sector-purple` (session best), on the tower in its
    personal-best green or a light violet for the fastest lap on track. The last lap is the number a driver is
    actually comparing against the car ahead, so it has to stay readable *as a
    time* first; grading it by recolouring the digits trades legibility for the
    grade, and the underline carries the same information in the same glyph box
    at no cost. `sector-purple` still colours the digits themselves, because a
    session-best lap is an event rather than a comparison.

11. **Ink on identity colour is measured, never declared.** The class chip and
    the position block are solid class colour (§ Two colour systems rule 2), so
    both print in whichever of the tower's dark ink and white measures the
    higher contrast against their own fill — `towerInk` in
    [`lib/towerPalette.ts`](src/lib/towerPalette.ts). `readableInk` in
    [`lib/contrast.ts`](src/lib/contrast.ts), the same idea against the theme's
    `on-accent`, is kept and tested for the surfaces that are still themed.

    It has to be. Even inside a palette this app owns, the five-colour ramp
    spans violet at L≈0.24 and lime at L≈0.65: white reads on one and vanishes
    on the other, and `on-accent` does the reverse. A single declared ink is
    wrong for half the ramp whichever one you pick.

    With class colours now the driver's to pick, the measurement matters more,
    not less: a pick can land anywhere a colour input reaches. `towerPalette.test`
    pins that every ramp colour clears 4.5:1 under its measured ink.

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
    - Relative **stops calling neighbours lapped traffic**. The tag and the
      danger ground are a race warning: they mean someone is losing a position
      or about to take one. Left on in practice they land on nearly every row —
      a table shouting at every row is a table saying nothing — and they bury
      the one number that still matters there, the gap to the car arriving in
      your mirrors mid-lap.

    **Nothing announces the switch**, and that is the restraint the rule turns
    on. The § Session strip already names the session; the missing columns are
    themselves the loudest possible signal; and a timesheet whose fastest-lap
    fill (rule 5) is always its own first row says what it is without a label.
    A banner reading `PRACTICE ORDER` would be a header band by another name,
    which is what rules 2 and 3 spent their whole argument buying back.

    An **unrecognised** session name keeps the race behaviour. Hiding columns
    on a guess is worse than showing a number the driver can judge themselves.

### The class header

The line that opens each class card on the tower:
`[GT3]  6 cars  SOF 4.1k  ……  BEST LAP [2:15.239] P. Costa`.

- **Quiet paper with the class's colour in one place.** The header is the
  card's own surface; the class's colour is the chip that names it, the same
  block every position in the card sits in (§ Two colour systems rule 2). The
  solid band it replaces put the whole class colour behind the heading, which
  was right while the band was the only thing grouping the rows; the card's
  edge does that now, so the colour can be spent where the eye lands first.
- **`BEST LAP` always sits on the class-best violet**, with the name of the
  driver who set it — `P. Costa`, first initial and surname, the way a timing
  graphic credits a lap. It is the same fill the lap wears in its own row, so
  the eye can go from the header to the row and back.
- **The car count is words, not a glyph.** `6 cars` replaces the helmet glyph
  the Pit Wall band used: the canvas spelled it out, and a count read in words
  needs no legend.
- **Fields drop right-to-left as the tower narrows** — the holder's name, then
  the best lap, then SoF, then the count — and the chip is the last thing
  standing, because a header that has clipped its own name has stopped doing
  its job.

### The session strip

One line above the field on the Relative:
`RACE · LAP 6/≈36 · LEFT 50:24 · INC 4x · TRK 38° · SOF 3.3k · AIR 22° · CLK 20:46`.

On the tower the same readout is the **race-control bar** — full words, larger
values, and a ground that changes under a yellow or a caution (§ The timing
tower, rule 9). The rules below still hold there, except that the bar's badge
is no longer the only fill it can carry.

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
  near-white on the Relative, 22 canvas px in the tower's text ink on the
  tower. This does not re-open § Two colour systems rule 2 — the mark is
  drawn in the row's own ink.
- **The class band** was rejected on the grounds that a gap separates classes
  for a third of the height. True, and irrelevant: separation was never the
  band's job. See rule 2 — where it is now the header of a class card.

The rejections that stand are both about *withholding information the reader
needs*, which is the pattern worth noticing — a rule that only removes chrome
is a rule that will keep getting revisited.

## The timing tower

The Standings screen, as the design canvas "Timing tower rediseñado" drew it on
2026-09-27 and the product owner asked for it to ship: the canvas's type, its
palette and its chips, inside this system's rules for anything read at speed —
nothing on it can be aimed at (§ Dense tabular overlays rule 7), and a column
that would lie is not shown (rule 12). The Broadcast overlay is the same tower
cut down for a stream (rule 12 below).

1. **It is one surface's look, not the app's.** The Manager, the Relative,
   Fuel & Strategy and the widgets keep Inter, mono and the runtime themes. The
   Relative is the obvious next surface to move and is recorded as a follow-up
   rather than half-done here: two timing surfaces in two languages for a
   release is a smaller cost than a Relative redrawn without a design of its
   own.
2. **Its palette is fixed and measured.** Every colour on the tower is in
   [`lib/towerPalette.ts`](src/lib/towerPalette.ts), and
   `towerPalette.test.ts` walks every ink against every ground it can land on —
   both zebra rows, your own row, every tint composited over each of them, the
   class header, the label row, the paper, both stripes of the safety-car bar —
   and fails below WCAG AA: 4.5:1 for text, 3:1 for the tyre rings, which sit
   beside a letter that carries the compound on its own. The palette does not
   follow the runtime themes (§ Theme), because a palette that is measured once
   has to stay the palette that was measured.

   Its colours say one thing each, and some say something different from the
   theme tokens elsewhere: on the tower, **blue** is places gained and your own
   car, **orange** is places lost and a slow sector, **violet** is the fastest
   in class, **green** a personal best, **yellow** the things a yellow flag is
   shown for. Blue/orange for up/down rather than green/red is the canvas's
   choice and the right one: it is the pair that survives red-green colour
   blindness, the commonest kind.
3. **Type is ranked: position → name → gap.** Barlow Condensed 700 for the
   position (22 px in its block) and the name (21 px, caps), then Barlow for
   every number — the primary gap at 16 px in full ink, the other times at
   15 px in secondary ink, the quiet columns at 14 px in tertiary. Everything
   is right-aligned in tabular figures with a fixed number of decimals per
   column, so decimals line up without a decimal tab, and **every time column —
   gap, interval, last, best, each sector — is the same 84 px wide**, so the
   timing half of the row is one rhythm.
4. **Ink on identity colour is measured.** The position block and the class
   chip print in `towerInk`: whichever of the palette's dark ink and white
   reads better on that fill. A class colour is the driver's to pick now
   (§ Two colour systems rule 1), and a pick can land anywhere.
5. **Grades are against the class, and the last lap is ruled.** A sector or a
   lap that is the fastest *in its class* takes the violet fill; the bridge
   grades sectors against the whole field, which in a multi-class race would
   never let a GT4 see violet, so the class bests are derived in the store
   ([`lib/sectorBests.ts`](src/lib/sectorBests.ts)). A personal best is a
   green tint with its own hairline ring — a different shape from the fill,
   not only a different colour. A big loss is bold orange delta, a small one a
   plain grey delta, always signed. The last lap keeps its ink and takes a
   2 px rule, as § Dense tabular overlays rule 10 has it.
6. **Every state is a word and a glyph, never a colour alone.** Beside the
   name: **PIT** (a filled badge, and the row's live timing — gap, interval,
   last lap, trend, sectors — greys out behind it), **OFF TRACK**, **DAMAGE**
   (the meatball), **OUT**, **FINAL LAP**, **FINISHED**. **DSQ** takes over the
   position block, strikes the name through and greys the row. Greyed ink is
   still 4.5:1 — quieter, not illegible.

   **OUT, not DISCONNECTED**, and that is a data decision rather than a
   wording one: the SDK reports a disconnected car and a car being towed the
   same way, not in the world, and a tow happens in nearly every race. A chip
   reading DISCONNECTED on a car sitting out a tow would be a visible, frequent
   lie.

   The final lap and the finish are derived in the bridge, because iRacing
   never puts the white or the chequer in a car's own `CarIdxSessionFlags`:
   each car's lap is snapshotted when the flag first appears in
   `SessionFlags`, and a car's final lap starts when it next crosses the line.
7. **A battle is a tint and a glyph.** A car within a second of the car ahead
   *in its class*, both racing, has its interval put on a tint of the class's
   colour, in bold, behind two closing arrows. It is measured against the
   interval **as printed**, to the tenth, so the pill never sits around a value
   that reads `+1.0`; and it is resolved over the whole field in the store,
   because half the answer is whether the car ahead is racing, which a row
   cannot see. The glyph is the colour-blind reader's cue; the tint is what
   finds the fight from the corner of the eye.
8. **The field is counted in threes.** The zebra runs a step stronger than
   the old table's, and a hairline sits after every third row (§ Dense tabular
   overlays rule 1).
9. **The race-control bar changes what it is under a flag.** On green it is
   quiet paper with one filled badge naming the session. Under a yellow the
   whole bar turns yellow and reads YELLOW FLAG beside a flag glyph; under a
   full-course caution — iRacing's pace car, called by its broadcast name — it
   turns amber, takes slow diagonal stripes and reads SAFETY CAR · NO
   OVERTAKING beside a car glyph. Word, glyph and pattern all differ, so the two
   stay apart for a reader who cannot tell amber from yellow; the ink on both
   is measured on both stripes. The bar is the one place on the tower meant to
   be seen without being looked at, and the one ground on it that may change.
10. **Tyres are named, and pace is a line.** The tyre is a ring in the
    compound's colour with its letter inside — S, M, H, I — and a wet is a
    dashed ring round a drop, a different *kind* of tyre drawn as a different
    shape. The name comes from `DriverInfo:DriverTires`, which iRacing added in
    the 2025 S3 build; without it the ring is neutral and carries the old index
    letters, because guessing that index 0 is a hard would be wrong in half the
    series. The pace sparkline shows the last five laps on **one fixed scale
    for every row** — the car's own best at the dotted baseline, two seconds
    slower at the top — because a scale fitted to each row would draw a car
    varying by a tenth as wildly as one varying by two seconds.
11. **The legend is a Manager toggle, off by default**, for the reason column
    labels are: it teaches the table once and is then a strip of pixels read
    past every lap.
12. **The Broadcast overlay is the tower cut to what an audience needs**:
    position in its class block, name, gap, in a 300 px column for the left
    edge of a 1920 × 1080 stream. It paints only itself, so an OBS browser
    source composites it over the game with nothing around it. The two states
    that change what a gap *means* stay — PIT in the gap cell, DSQ in the
    position block — and nothing else does: sector splits and tyre ages are the
    driver's, not the viewer's.

## The marketing surface

One page at [`site/`](site/): static HTML, three stylesheets and ~30 lines of
inline script for the theme toggle — no build step, no framework, deployable as
a folder. It is a **third surface class**, and the
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
control contract, and the focus-ring rule.

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

6. **Scroll-driven devices — three of them, and each one reports or reveals
   rather than performs.** A section fade on entry, a 26 px drift on the
   product captures, and a progress rule along the pinned nav that fills with
   how far down the page you are. That last one is the reason the set is
   allowed at all: a bar reporting a measured quantity is the same instrument
   voice as the § Session strip, not decoration borrowed from a template.

   Five fences, and the first two are the ones that keep this from becoming the
   templated-editorial tell it usually is:

   - **Transform and opacity only**, per § Motion — never a layout property.
     The fade is opacity; the drift and the progress rule are transforms.
   - **Amplitude is the argument.** The drift is ±13 px over a capture's whole
     pass through the viewport: felt, not watched. At the 80–120 px a parallax
     library defaults to, a screenshot whose entire job is to be *read* would
     be sliding while you read it. It moves the `<figure>`, never the `<img>`
     inside it — an image shifting within its own frame reads as a bug; a
     framed picture drifting against the paragraph beside it reads as depth.
   - **Never above the fold.** The range ends inside `entry`, so anything
     already on screen when the page opens renders at full strength. A hero
     that fades in is a hero the reader waits for.
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
   - **`--color-timing-bg` stays near-black in both.** It grounds the product
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

   This is the only script on the surface and the only script this system has
   outside the app itself. Anything else that wants to be added here has to
   argue for itself the way this did.

8. **The product's own readout devices, at page scale.** Rule 6 admitted the
   progress rule on the argument that *a bar reporting a measured quantity is
   the same instrument voice as the § Session strip*. Two devices now cash that
   argument in properly, and both are the app's own furniture rather than
   anything borrowed from a marketing template.

   - **The page's session strip** (`.readout`) sits in the dock under the nav
     row: the six sections as mono micro-labels, with the one you are reading
     filled. It is the § Session strip's grammar exactly — a row of fields, one
     fill, and the fill marks the state that changes what you do next. It takes
     `primary` (§ Theme: selection) and `on-accent` ink (§ Theme rule 1).

     It costs **no JavaScript**, per rule 6's fourth fence: six `view()`
     timelines declared on the sections and referenced from the dock through a
     `timeline-scope` on `:root`. The scope has to be on the root and not on
     `main` — the sections that *define* the timelines are inside `main`, the
     strip that *references* them is not, and the scope must cover both. Where
     scroll-driven animations are unavailable the strip is six plain links,
     which is what it is anyway.

     **The nav row above it is still N9.** Wordmark left, actions right,
     nothing between. This is a readout *below* the nav, not links moved into
     it — and it is the only wayfinding on a page ~5,600 px tall.

   - **The section band** (`.band`) opens every section, including the hero, in
     the grammar of the old class band (now § The class header): a chip
     naming the subject, then micro-label / value pairs carrying that
     subject's own numbers — `COLUMNS 15 · ALWAYS 2 · ROW 44px`. Every value is a fact checkable in this repo or in a capture on
     the page, so the band is inside the honest-copy rule below rather than an
     exception to it. Its 3 px leading edge is the same device as the Relative
     row's class edge — one device, two surfaces — and it takes
     `border-strong` rather than a status colour, because on this surface it
     carries structure and there is no identity colour to quarantine
     (§ Two colour systems is a product-surface rule).

     This is the answer to a page that hosted the instrument in screenshots but
     did not speak its language anywhere else: the hero was a headline, a lede
     and a filled button, which is the layout of every other product page and
     told the reader nothing this product is. Numbered section markers were
     tried and cut — the fill already reports position, and an ordinal beside
     it is the decoration this system does not use.

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

**Pit Wall, 2026-08-18.** The near-square radii, the 13.5° shear as a system
device, the solid class band, the position block, the caps on CTAs and driver
names, and the deepened neutrals were chosen from four directions drawn on a
design canvas and reviewed side by side against the shipped v1.8 UI. Nothing
was taken from an outside reference on this pass: the shear is the app's own
mark (§ The mark), and the rest is this system's tokens re-rationed. The
sections it rewrote — § Two colour systems rule 2, § Dense tabular overlays
rules 5 and 11, § The class band — were rewritten rather than patched, because
each had banned in principle the thing the direction turned out to need, and a
patch would have left the ban standing next to its exception.

**The timing tower, 2026-09-27.** The Standings screen was redrawn from a
design canvas, "Timing tower rediseñado", that the product owner commissioned
and asked to ship as drawn. Unlike every pass above, this one *did* take values
and not only structure: the canvas's type (Barlow, Barlow Condensed), its fixed
palette, its radii and its geometry came across one for one, and they are the
canvas's, in canvas pixels — which is why § The timing tower fences them to one
surface instead of folding them into the tokens. What did not come across is
anything the canvas drew that this system's rules refuse: its two header
controls (§ Dense tabular overlays rule 7), and a DISCONNECTED state the data
cannot honestly support (§ The timing tower rule 6). Every colour that came
across was measured before it shipped — `towerPalette.test.ts` — rather than
trusted because the canvas used it. The sections it rewrote — § Two colour
systems rule 2, § Dense tabular overlays rules 1, 2, 5 and 8, and § The class
band, now § The class header — were rewritten rather than patched, for the same
reason as the pass before it.

## Known follow-ups

- **The Relative is still in the Pit Wall language.** Two timing surfaces in
  two faces and two palettes is the visible cost of § The timing tower rule 1.
  Closing it needs a design of the Relative's own — the tower's card grammar
  does not fit a table sorted by track position — not the tower's tokens
  copied across.
- **The tower ignores the runtime themes**, by § The timing tower rule 2. A
  user on Endurance gets the tower's own neutrals beside an Endurance Manager.
  The fix, if one is ever wanted, is a second *measured* tower palette per
  theme, not a theme re-tinting the measured one.
- **The site has no capture of the Broadcast overlay.** It is the one overlay
  the page counts but does not show. A shot of it over a game frame — which is
  the only honest way to show something that paints nothing around itself —
  needs a background the capture script does not have.

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

- ~~The overlay widgets' own header labels are still sans.~~ **Moot** — there
  is no widget header left to set. The two micro-labels in
  `widgets/primitives.tsx` are still mono, which is what § Typography always
  said they should be, but the header this entry was really about — icon, name,
  rule — is gone from the dashboard widgets, their popped-out windows and the
  Manager preview alike. A label you have already learned costs a glance every
  time you skip it, and a speed gauge does not need the word "speed" on it. The
  card is content edge to edge now, and the whole of it is the drag target,
  since there is no header to grab and nothing in a readout to grab by mistake.
  Its actions live in the top-right corner and appear on hover.

  The unresolved half of this entry went with it: there is no longer a 10 px
  header label whose legibility over a bright kerb was being reserved for
  judgement.
- `--color-danger` and `--color-warning` have no `-dim` counterpart, so a
  filled destructive button has no hover fill. Not needed yet: destructive
  actions here are outline-at-rest.
- **The Relative's `gap` column colours cars behind with `danger`.** By the
  § Theme table that reads as *critical*, which a car three seconds back is not.
  It wants a token the palette does not have yet — "behind you" is neither
  positive nor a warning — so it is left alone rather than guessed at.
- **Rule 3 repeats the labels once per class card** on the tower. Correct by
  the rule — each card is its own small table — but in a two-class field the
  second label row sits six rows below the first, which may be one more than it
  needs to be.
- ~~**Rule 7 cost the standings its class *names*.**~~ **Done** — by the class
  band of rule 2, which names the class and carries its numbers besides. An
  interim fix printed `GT3 · 6` in the leader row's `Driver` label slot; the
  band supersedes it, and the `Driver` label is back.
- **Per-class collapse and solo-filter are still gone**, and neither the
  band's return nor the card that replaced it brings them back — though the
  design canvas drew a collapse arrow on every class header. Rule 7 outranks
  rule 2, and per-class state is session data rather than configuration, so
  it has no home in the Manager either. Worth revisiting only if a large
  multi-class field actually proves unreadable without them.
- **The class header repeats no session-wide value**, unlike the reference,
  which reprints lap, clock and track temperature on every band. Those live
  once, on the race-control bar. If a user ever runs the headers without the
  bar and misses them, the answer is to let the *bar* pin rather than to
  duplicate it per class.
