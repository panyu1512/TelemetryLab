/**
 * How a driver's name is set on the timing surfaces — one helper, used by both
 * Standings and Relative, so the two can never set the same name two ways.
 *
 * iRacing's `UserName` is the account's real name **as the member typed it**,
 * which is the whole problem: the same grid holds `John Smith`, `JOHN SMITH`,
 * `john smith` and `Tuan LE`. The surfaces used to paper over that with CSS
 * caps, which made every name equally loud and equally hard to recognise —
 * caps are read by outline, and a name's outline is most of how it is found at
 * a glance. Title case keeps the ascender/descender silhouette and still gives
 * the column one consistent voice.
 *
 * The rules, in the order they are applied to each word:
 *
 * 1. **A word that is already mixed case is left alone.** `McDonald`,
 *    `DeVries`, `LeClerc` were cased on purpose by the person they belong to;
 *    flattening them to `Mcdonald` would be this app "correcting" someone's
 *    own name.
 * 2. **In a name that is already mixed case, a lower-case word between two
 *    others is left alone too.** `Max van Berg` and `Pedro de la Rosa` keep
 *    their particles; `max Verstappen` still becomes `Max Verstappen`, since a
 *    particle never opens or closes a name. Only when the *whole* name arrives
 *    in one case (all caps or all lower) do we have no evidence of intent, and
 *    every word is title-cased.
 * 3. **An all-caps or all-lower word is title-cased per segment**, where a
 *    segment boundary is a hyphen, an apostrophe or a full stop — so
 *    `JEAN-PIERRE` → `Jean-Pierre`, `O'BRIEN` → `O'Brien`, `J.J.` stays `J.J.`.
 * 4. **`Mc` prefixes capitalise the next letter** (`MCLAREN` → `McLaren`).
 *    `Mac` deliberately does not: `Mack`, `Macy` and `Machado` are names too.
 * 5. **A generational suffix stays in caps** (`Smith III`), anywhere after the
 *    first word.
 *
 * What this cannot know: a name typed entirely in one case carries no evidence
 * of particles or of a two-letter initial, so `MAX VAN BERG` reads
 * `Max Van Berg` and `JJ SMITH` reads `Jj Smith`. Both are better than caps,
 * and guessing either way is wrong for someone.
 */

/** Unicode-aware letter classes, so `JOSÉ` and `ÅSA` case like `JOHN` does. */
const UPPER = /\p{Lu}/u;
const LOWER = /\p{Ll}/u;

/** Characters that start a new capitalised segment inside one word. */
const SEGMENT_BREAK = /([-'’.])/u;

/**
 * II, III, IV: generational suffixes, kept in caps after the first word. Stops
 * at IV on purpose — `Vi` is a surname, and a lone `V` or `X` is an initial,
 * which title-casing already leaves upper-case.
 */
const ROMAN_SUFFIX = /^(?:ii|iii|iv)$/i;

function hasUpper(s: string): boolean {
  return UPPER.test(s);
}

function hasLower(s: string): boolean {
  return LOWER.test(s);
}

/** Both cases present — the word (or name) was cased deliberately. */
function isMixedCase(s: string): boolean {
  return hasUpper(s) && hasLower(s);
}

/** `bRIEN` → `Brien`; `mcdonald` → `McDonald`. */
function capitalise(segment: string): string {
  if (!segment) return segment;
  const lower = segment.toLowerCase();
  // Code-point aware: the first *character*, not the first UTF-16 unit.
  const [first, ...rest] = Array.from(lower);
  const head = first.toUpperCase() + rest.join("");
  if (/^mc\p{L}/u.test(lower) && Array.from(lower).length > 3) {
    const chars = Array.from(head);
    return chars[0] + chars[1] + chars[2].toUpperCase() + chars.slice(3).join("");
  }
  return head;
}

/** Title-case one word, segment by segment. */
function titleWord(word: string): string {
  return word
    .split(SEGMENT_BREAK)
    .map((part) => (SEGMENT_BREAK.test(part) ? part : capitalise(part)))
    .join("");
}

/**
 * A driver's name in title case, per the rules above. Collapses runs of
 * whitespace and trims; returns `""` for a blank name so the caller's own
 * fallback (`Car 12`) can take over.
 */
export function formatDriverName(raw: string | null | undefined): string {
  const words = (raw ?? "").trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return "";

  const nameIsMixed = isMixedCase(words.join(" "));

  return words
    .map((word, i) => {
      if (i > 0 && ROMAN_SUFFIX.test(word)) return word.toUpperCase();
      if (isMixedCase(word)) return word;
      // A lower-case word *between* others in a deliberately cased name is a
      // particle the owner typed that way (`van`, `de la`) — leave it. Never
      // the first or last word: a particle always has a name either side.
      const interior = i > 0 && i < words.length - 1;
      if (nameIsMixed && interior && !hasUpper(word)) return word;
      return titleWord(word);
    })
    .join(" ");
}
