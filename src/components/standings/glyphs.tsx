/**
 * The tower's glyphs, drawn from the design canvas rather than an icon set: each
 * one is a single idea at 12–18 px, stroked in `currentColor` so it takes the
 * ink of whatever chip or badge carries it.
 *
 * They are never the only carrier of a state. Every glyph sits beside the word
 * it illustrates (`design.md` § The timing tower, rule 6), so each is
 * `aria-hidden` unless it stands alone.
 */

interface GlyphProps {
  size?: number;
  className?: string;
}

function Stroke({
  size = 13,
  className,
  children,
  strokeWidth = 2.2,
}: GlyphProps & { children: React.ReactNode; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  );
}

/** A flag on a pole — filled, so a white flag reads as white. */
export function FlagGlyph(props: GlyphProps) {
  return (
    <Stroke {...props}>
      <path d="M5 21V4" />
      <path d="M5 4h13l-3 4.5 3 4.5H5z" fill="currentColor" />
    </Stroke>
  );
}

/** A chequered flag: the same pole, a two-by-two board. */
export function ChequerGlyph(props: GlyphProps) {
  return (
    <Stroke {...props}>
      <path d="M5 21V4" />
      <path d="M5 4h14v9H5z" />
      <path d="M5 4h7v4.5H5zM12 8.5h7V13h-7z" fill="currentColor" />
    </Stroke>
  );
}

/** Two track edges and an arrow leaving between them: off the circuit. */
export function OffTrackGlyph(props: GlyphProps) {
  return (
    <Stroke {...props}>
      <path d="M5 3v18" />
      <path d="M12 3v3M12 10v3M12 17v4" />
      <path d="M8 18l12-9" />
      <path d="M15 9h5v5" />
    </Stroke>
  );
}

/** A connection with a line through it: out of the world. */
export function OutGlyph(props: GlyphProps) {
  return (
    <Stroke {...props}>
      <path d="M3 3l18 18" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0" />
      <path d="M4.5 12.5a11 11 0 0 1 6-3" />
      <path d="M19.5 12.5a11 11 0 0 0-3.5-2.3" />
      <path d="M12 20h.01" />
    </Stroke>
  );
}

/** A spanner: the meatball, repairs required. */
export function WrenchGlyph(props: GlyphProps) {
  return (
    <Stroke {...props}>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6z" />
    </Stroke>
  );
}

/** Two arrows closing on each other: a fight for position. */
export function BattleGlyph(props: GlyphProps) {
  return (
    <Stroke strokeWidth={2.6} size={12} {...props}>
      <path d="M3 12h6" />
      <path d="M6 8.5 9.5 12 6 15.5" />
      <path d="M21 12h-6" />
      <path d="M18 8.5 14.5 12 18 15.5" />
    </Stroke>
  );
}

/** A car in profile: the safety car. */
export function CarGlyph(props: GlyphProps) {
  return (
    <Stroke strokeWidth={2} size={18} {...props}>
      <path d="M5 17H3v-4l2-1 3-4h7l3 4 3 1v4h-2" />
      <path d="M9 17h6" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </Stroke>
  );
}

/** A drop: the wet tyre, drawn instead of a letter. */
export function DropGlyph({ size = 11, className }: GlyphProps) {
  return (
    <svg
      width={(size * 9) / 11}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 3C9 7.5 6.5 10.5 6.5 14a5.5 5.5 0 0 0 11 0C17.5 10.5 15 7.5 12 3z" />
    </svg>
  );
}
