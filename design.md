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
| `--color-lapped` | Relative ink for a car a lap or more behind you — the sim's blue flag. Fixed, not themed | grounds, fills, anything but that ink |
| `--color-tyre-wet` | a wet tyre: the ring and `W` of the Relative's compound badge. Fixed, not themed | anything but that badge |

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
   red on danger (off-track, a faster class closing), and a red class badge
   beside a red alarm is two unrelated statements in one hue. At four or five
   classes some class landing on red, on the blues that mean "this is you" and
   "lapped traffic", or on the amber that means "pit" stops being a risk and
   becomes an expectation.

   So the five class colours now come from
   [`lib/classColors.ts`](src/lib/classColors.ts), spaced against every status
   hue in all four themes: `danger` 24–28, `primary` 253–257 (and 45 in
   Endurance), `warning` 81–82, `accent` 154–157, `sectorPurple` 295–302, plus
   the fixed `lapped` blue at 245 (a test reads it from `styles.css`). Every
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
2. **Identity colour is the leading edge — never a row's ground.** The edge —
   4 px on a row ([`StandingsRow.tsx`](src/components/standings/StandingsRow.tsx)),
   the same device on a class band — is the one carrier of class on Standings.
   On Relative, which mixes classes row by row under no band, it is joined by a
   class badge opening the row.

   **The edge is full strength on every row, on both surfaces.** It used to
   drop to 40 % below the class leader (and, on Relative, below the player),
   which read as a rendering fault rather than as a rank — one row lit, the
   rest broken. Solid, the band's edge and the rows' join into one spine of
   class colour down the group, which is what lets the class register from
   shape now that nothing else in the group is filled with it.

   **Neither surface gives a row a class ground.** Relative used to wash every
   row at 14 % of its class colour; in a race that produced a table of grounds
   — class washes, red off-lap tints, the player's blue — in which "this is
   you" was one block of colour among six. The Relative row now opens with a
   **class badge** instead: the class's short name on a solid block of its
   colour, flush against the edge. It is only drawn when the field has more
   than one class; a column where every row says `GT3` says nothing.

   Nothing drives an identity carrier's extent per row, and nothing should.
   Everything on these surfaces that could — lap progress, gap to the class
   leader — moves at 10 Hz, and a fill redrawing itself on every row on every
   tick is motion in the corner of the eye that means nothing.

   **Every row is a strip on one neutral ground, and the only coloured ground
   is the player's.** Both surfaces lay each row on `--color-timing-row` — a
   white lift off the paper, the same on every row — with `ROW_GAP` of paper
   between one strip and the next. That is not the zebra and class-group
   banding Standings once had: those made alternate rows or groups different
   for a reason the reader could not name, where a strip per row ranks none of
   them. Status still rides in ink (lapped traffic's blue, the gap's red) or in
   a single cell (the fastest-lap fill), never across a row.

   **Identity colour fills one thing: the Relative's class badge.** Standings
   used to fill its class band solid with the class colour, and the position
   cell of every row under it with the same block one column wide —
   masthead a block, each row opening on it. That was right while the rows sat
   on bare paper and the band had to out-shout nothing. With the field drawn as
   a stack of strips it reversed: a solid band became the loudest object on
   the surface, louder than the fastest-lap fill rule 5 reserves that for, and
   a solid block in every row put identity colour in front of the one number
   read first. The band is now a strip like the rows, with the same edge; the
   position is a plain number. Ink on the badge is measured by `readableInk`,
   not declared — a class colour can land anywhere on the wheel, so neither
   white nor `on-accent` can be assumed. See § Dense tabular overlays rule 11.
3. **"This is you" is `primary`, and it is the row's ground, not its ink.**
   `bg-primary/25` plus an inset `primary/50` ring, on both surfaces
   (`PLAYER_ROW_GROUND`). It was `/15` while it was the only ground on bare
   paper; with every row now a neutral strip, it is the *hue* of the ground
   that has to say "this is you", and at `/15` that hue barely cleared the
   neutral strips around it. The ring keeps it findable in Graphite, whose
   `primary` is close to neutral. **It is the only ringed row, and on both
   surfaces the only row whose ground has a hue**: lapped traffic is blue *ink*
   (§ Dense tabular overlays, rule 14), so the ground and ring stay an answer
   to "which one is me" and nothing else. This is the "selection"
   sense of `primary` in the table above, which is why the token row now says
   so out loud. Tinting the *text* instead would put an identity colour and a
   status colour in the same glyph.

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
- **The timing tables: Saira** (`--font-timing`), on Standings and Relative
  and nothing else — rows, bands, strips, column labels and the tyre badge
  alike, so each table speaks one face. Inter is a superb interface face and,
  across a whole overlay, an anonymous one; these two tables are the app's
  signature and wanted a face that reads as motorsport at a glance. Saira's
  squared, technical forms do, and it was chosen over the obvious field on
  three tests: **true tabular figures** (a lap-time column must not jitter —
  Rajdhani has none, and Exo 2's default figures sit at uneven heights), **an
  x-height close to Inter's** (Titillium Web reads a size smaller, which would
  have meant re-tuning every size rule 8 settled), and **a variable weight
  axis**, so 600 and 700 are both real cuts. Bundled with the app
  (`@fontsource-variable/saira`), never fetched: the overlays run offline.

  It stops at those two tables. Fuel & Strategy, the dashboard widgets and the
  Manager stay Inter — the Manager is a surface you configure in, not one you
  read at speed, and the other overlays have layouts tuned to Inter's metrics.
- **Mono** (`--font-mono`) is the third voice, and it is *semantic*, not
  stylistic. It marks **instrument nomenclature**: measured values, coordinates,
  counts, protocol versions, log lines, channel labels, status readouts.
- Prose — descriptions, hints, help text — is always sans. If a string is a
  sentence someone reads, it is sans. If it is a value or the name of a
  channel, it is mono.
- Numerals in any column or ticking value carry `.tnum`.
- Micro-labels are mono, uppercase, `tracking-[0.12em]`–`[0.14em]`, `text-faint`
  — except on Standings and Relative, where they are set in the tables' own
  face: the column labels in `faint`, and the session strip's and class bands'
  labels in bold caps `muted` (`StripField voice="sans"`, § The session strip).
  Those strip labels sit on a lifted strip, where `faint` sinks under the floor
  it was tuned to clear, and next to bold rows, where mono read as a different
  kind of text.
- **Headings are roman.** No italic display type anywhere.
- **Caps are structural, not emphatic.** Three things are set in capitals and
  nothing else is: micro-labels (mono, or the timing strips' sans), section and
  page headings — a class band's class name is one — and CTAs (§ CTA voice). **Driver names are title case**, on both timing surfaces,
  through one helper ([`lib/driverName.ts`](src/lib/driverName.ts)). They were
  caps, to hold a single optical weight down the only ragged column; that cost
  the ascender/descender silhouette a name is recognised by, and ~12 % width in
  the one column allowed to truncate. Title case gets the single voice by
  normalising the member's own casing instead (`JOHN SMITH` → `John Smith`,
  `O'BRIEN` → `O'Brien`), and leaves deliberate casing alone (`McDonald`,
  `van Berg`).

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

- The token names (not the values — those move per theme).
- The colour *meanings* in the table above.
- Inter + mono, with mono reserved for instrument nomenclature.
- The mark, and the four rules under § The mark.
- The control contract and the 8 states.
- 2 px radii throughout — controls, cards and panels alike.
- `.tnum` on every column of numbers.

## What surfaces MAY differ on

- Presence of the preview pane (Workbench with or without it).
- Density — an overlay over game footage is tighter than the manager.
- Which status colours appear at all; most surfaces use none.

## Per-surface allowances

- **Manager chrome** speaks the instrument voice: mono channel labels, the
  `.section-block` legend on the shear, the three-state sidebar rail, and the
  shear on its chips and CTAs (§ The mark rule 5).
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
in [`constants.ts`](src/components/standings/constants.ts): `ROW_H` 32 px, of
which the row's strip takes all but `ROW_GAP` 3 — and a brand mark the strip
less 4 px either side (`STANDINGS_BRAND_H`, 21; 24 on Relative's 34 px row),
so no mark ever reads as touching the strip's edge — — the two the rules below
buy back — `COL_LABEL_H` 10 and `CLASS_GAP` 10, plus `STRIP_H` 26 when the
§ Session strip is on. Every rule below is downstream of
the fact that a header band and a row cost the same height.

1. **No vertical rules, no row separators — rows are strips, and paper
   separates them.** Every row sits on the same `--color-timing-row` ground
   with `ROW_GAP` of paper under it, so the field reads as a stack of strips,
   each opening on its class edge. At 32 px a drawn rule costs more attention
   than it returns; a 3 px seam of the darker paper does the same separating
   with nothing drawn at all. No banding: every strip is the same tone, so no
   row is ranked by its ground (§ Two colour systems, rule 2). The session
   strip and class bands are strips of the same kind, so nothing on these two
   surfaces needs a hairline any more; Fuel & Strategy's strip keeps its own.
2. **Class separation is a gap — and, on Standings, a band that earns its
   height by carrying the class's own numbers.** The gap does the separating;
   it reads pre-attentively and costs a third of a band. What the earlier absolutist version of this rule got wrong is that
   separation was never the only job. A class's **car count, strength of field
   and fastest lap** are per-class and per-group: the session strip cannot hold
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
   catch. Identity no longer fills anything on Standings (§ Two colour systems,
   rule 2); on Relative the class badge is the one identity fill.

   **The licence and iRating pill is a ground, not a fill.** Licence + safety
   rating and iRating + its projected change are one compound cell in two
   segments (rule 4): `A3.45 | 8895 ⌃14`. The licence segment is the licence's
   own colour taken to 42 % toward black, with white ink — dark enough that
   white clears 8:1 on even C's yellow, so it reads as a tone on the row rather
   than a beacon — and the iRating segment is a neutral white lift. The two
   columns stay separately switchable; when both are on, the licence segment
   reaches across the column gap and the two square off where they meet.

   This replaced the **tint** device — a ≤ 18 % wash of a value's own hue
   behind ink of that hue — that licence, iRating and position change used to
   wear. A tint grouped a compound cell on bare paper; on a strip it was a
   second ground inside the first. Position change is now coloured ink and a
   chevron, with nothing behind it.

   **A chip in a column is sized by the column, not by its contents.** `8895
   ⌃14` and `1423` hugging their own text are two different widths in the same
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
   widths, the § Session strip above them. The layout tuned at full size is the
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
   the 2 px already rejected — see `CLASS_EDGE_WIDTH`. And the § Session strip
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
   than anywhere else in the app.** 13 px bold names, 12 px semibold-to-bold
   values, 14 px bold positions, on `ROW_H` 32 (Standings) / 34 (Relative). Every other
   surface in this system is read by someone looking *at* it; these are read in
   peripheral vision at 200 km/h by someone who must not look away for long.
   The density lost to the extra pixels is bought back by rules 2, 3 and 7,
   which is what those rules are for.

9. **They paint on their own near-black paper**, `--color-timing-bg`, not the
   app's `surface` graphite, and they keep it opaque over live footage instead
   of dropping to glass. A 32 px row of 12 px type cannot afford to let a
   sunlit kerb through. The token carries the active theme's hue so the surface
   stays part of the system. Rows sit on it as strips of `--color-timing-row`,
   a white alpha rather than a mixed colour, so a strip lifts whatever paper is
   under it — every theme's, and the translucent black the paper becomes over
   live footage.

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

11. **Ink on identity colour is measured, never declared.** The Relative's
    class badge is solid class colour (§ Two colour systems rule 2), so it
    prints in ink chosen from its own fill's WCAG luminance by `readableInk` in
    [`lib/contrast.ts`](src/lib/contrast.ts) — the only place in the app where
    ink on a fill is computed.

    It has to be. Even inside a palette this app owns, the five-colour ramp
    spans violet at L≈0.24 and lime at L≈0.65: white reads on one and vanishes
    on the other, and `on-accent` does the reverse. A single declared ink is
    wrong for half the ramp whichever one you pick.

    The class band and the position block used to be solid class colour too,
    and measured their ink the same way — which is also why the band's
    session-best lap moved from purple ink to a purple fill, since purple on
    lime is unreadable. Both are neutral strips now; the band's `BEST` keeps
    the purple fill, which reads the same on a strip as it does on a row.

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
      blue ink are a race warning: they mean someone is losing a position
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

13. **Standings reads rank, car, driver — then the data.** The column order is
    `pos · Δ · # · make · flag · NAME` and then the timing columns. Position
    leads, flush against the class edge and directly under the band's class
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
    for rain. So the cell — now on Relative, see below — is a ring with one
    letter: **`D` in white (`text`) for a dry, `W` in `--color-tyre-wet` blue
    for a wet**, then laps on the set in the row's ink. Blue is its own token,
    fixed and unthemed like `lapped` and deeper than it, so a wet badge on a
    lapped row still reads as a badge (§ Theme table).

    This reverses two earlier calls. A letter in a ring was rejected because at
    the table's smaller scales an 8 px letter in a thin 15 px circle read as a
    clock face; the badge answers that with a heavy ring and a bold letter set
    as large as the ring allows, and with colour carrying the distinction a
    second time. And a side-on tyre glyph — slick hub or water drop, shape
    only — replaced the letter; at row size that asked the reader to tell a
    dot from a drop.

    **The tyre lives on Relative, not Standings.** Whether the cars around you
    have gone to wets, and how old the rubber is on the car you are about to
    race, is a question about neighbours, which is the Relative's whole
    subject. Standings carried it for the whole field, at the cost of a column
    on the widest surface in the app. It is a Manager option there, on by
    default.

    The same rule covers alignment. **Every lap cell carries the fastest-lap
    chip's padding, filled or not**, so the filled time sits on the same
    vertical as every other time in its column. Padding only the filled chip
    pushed the one number the others are compared against out of line with
    them.

16. **A change of place is held long enough to be seen.** Rows glide to their
    new slots in 220 ms, and under reduced motion they do not glide at all; a
    driver who glances over a second after a pass sees a table in a new order
    with nothing to say what changed. So for three seconds the position cell
    of each car that moved becomes an arrow on a status fill — up on `accent`,
    down on `danger`, `on-accent` ink — and then the number comes back
    ([`lib/positionFlash.ts`](src/lib/positionFlash.ts)). It costs the number
    for those three seconds, which is the trade: the `Δ` chip beside it still
    carries the count since the start, and the new position is the one fact
    the arrow is about. A change of what the number *means* — grouping
    switched between class and overall — re-baselines silently rather than
    flashing every row.

    The leader's row has no gap and no interval, so those two cells print
    **`GAP` and `INT`** instead of two em dashes: on the one row where the
    number cannot exist, the cell names its column rather than reporting
    something missing.

### The class band

One line opening each class group on Standings:
`GT3 · SOF 4078 · ⛑ 6 · BEST 2:15.239`.

- **The band is part of its group, not furniture above it.** It is a strip
  like the rows under it — the same `--color-timing-row` ground, the same
  class edge on the same vertical — so the band's edge and the rows' make one
  spine of class colour down the group. It used to be the class colour
  **solid** across its whole width; see § Two colour systems rule 2 for why
  that turned, once the rows became strips.
- **It is a heading because of what it says and where it sits, not because of
  its fill.** The class name opens it, in the rows' 13 px bold, caps, with a
  minimum width equal to the position column's so `GT3` sits centred over the
  column of positions it heads; its `ml-1` matches the row's `px-1`. And it is
  set apart from its group by `BAND_GAP` 4 under `CLASS_BAND_H` 30 — a band
  flush against the first row reads as that group's first entry.
- **It speaks the session strip's grammar**, `StripField` in its sans voice:
  `SOF` in full (`4078`, not `4.1k` — a rating is four characters either way,
  and the abbreviation threw away the digits a driver compares), the car count
  behind a helmet glyph (the population the other two measure, so a glyph
  rather than a word), and `BEST`.
- **`BEST` takes a `sector-purple` fill** when that class's fastest lap is also
  the session's — the same meaning purple carries in every row.
- **Fields drop right-to-left as the overlay narrows**: `BEST`, then the car
  count, then `SOF`. The class name is the last to go, because a band that has
  clipped its own name has stopped doing its job.

### The session strip

One line above the field, on both timing surfaces:
`RACE · LAP 6/≈36 · LEFT 50:24 · INC 4x · TRK 38° · SOF 3.3k · AIR 22° · CLK 20:46`.

- **It is a strip like the rows**, on the same `--color-timing-row` ground,
  not a line of type on a hairline. Standings and Relative read top to bottom
  as one stack of strips: session, class, cars.
- **Every field is a word plus a bold value**, both in the rows' bold sans —
  the label in `muted` caps, the value in `text` (`StripField voice="sans"`).
  They were mono with a `faint` label; on the strip's lifted ground `faint`
  sank under its floor, and mono set the strip apart from the rows it heads.
  This is still the § Deliberately not adopted note on icon-only strips,
  cashed in: a thermometer glyph the user has to *learn* is not a readout, it
  is a quiz.
- **`SOF` prints in full**, as on the class bands and in the iRating column.
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

### Fuel & Strategy in the timing language

Fuel & Strategy shares the timing paper (rule 9) and the no-aim rule (rule 7);
it now shares their grammar too, because a driver glancing from the standings to
the fuel panel should not have to re-learn where the numbers are.

- **A strip, not a title bar.** `FUEL · <track> · MARGIN 1.0 lap`, at the
  session strip's height on its hairline, built from the strip's own
  `StripField` in its default **mono** voice — the voice of every legend in the
  panel, which is why it did not follow the timing strips to sans. The icon-and-heading title it replaces was the last piece of
  window chrome on an overlay screen. The `FUEL` tag is unfilled: the panel's
  one status fill is the verdict block directly beneath it.
- **Sections are the class-group tone, not cards.** Plain `white/[0.035]` on the
  paper with a mono micro-label legend instead of bordered `surface-2` graphite, which read as a
  second product pasted onto the first. The dashboard's Tyres corners take the
  same ground for the same reason.
- **Values are bold, micro-labels are mono.** Its labels were sans caps, the one
  timing surface that set them that way.
- **Bars are square-ended on a visible track**, like every dashboard bar. A
  rounded pill on a track the colour of its card read as a lozenge floating in
  space rather than as a level in a tank.
- **The verdict's tint is `color-mix`ed from its status token.** It was built
  by appending a hex alpha to `var(--color-warning)`, which is invalid CSS: the
  ground and border were dropped and the block rendered as a white outline.
- **Plans are rows, not pills.** The plan name sits in a fixed-width mono slot so
  stops line up down the list; the recommended plan wears the player row's
  `primary` ground and ring — the same "selection" statement — rather than a
  border style of its own.

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
  50:24/1h …`). The session strip is its own Manager toggle and is shared with
  Relative, where there is no band to fold it into; it is restyled as a strip
  of the same kind instead.
- **Icon-only fields** (a track glyph for temperature). See above.

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
     the § Class band's grammar: a chip naming the subject, then micro-label /
     value pairs carrying that subject's own numbers — `COLUMNS 15 · ALWAYS 3 ·
     ROW 32px`. Every value is a fact checkable in this repo or in a capture on
     the page, so the band is inside the honest-copy rule below rather than an
     exception to it. Its 3 px leading edge is the standings row's left border
     at a larger scale — one device, three sizes — and it takes
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
