import { useMemo } from "react";
import type { TelemetryData } from "../../hooks/useTelemetry";
import { MATRIX_SIZE, glyphDots, radarLabel, radarSides, type GLYPHS } from "../../lib/radar";

/*
 * The radar is two LED boxes and nothing else: an **L** at the left edge of
 * the window and an **R** at the right, each a square dot matrix in a carbon
 * frame. A box's letter glows red while the spotter calls a car alongside on
 * that side; otherwise its LEDs sit dark, the letter just readable in unlit
 * red so the box says which side it is. Size the window to sit either side of
 * your car on screen, or narrow it to bring the two boxes together.
 *
 * The look lives in styles.css (`.radar-box`), on the theme's tokens.
 */

function LedBox({ letter, lit }: { letter: keyof typeof GLYPHS; lit: boolean }) {
  const dots = useMemo(() => glyphDots(letter), [letter]);
  return (
    <div className={`radar-box ${lit ? "radar-box--lit" : ""}`}>
      <div
        className="radar-box__panel"
        style={{
          gridTemplateColumns: `repeat(${MATRIX_SIZE}, 1fr)`,
          gridTemplateRows: `repeat(${MATRIX_SIZE}, 1fr)`,
        }}
      >
        {dots.map((on, i) => (
          <span key={i} className={on ? "radar-led radar-led--glyph" : "radar-led"} />
        ))}
      </div>
    </div>
  );
}

export function RadarWidget({ data }: { data: TelemetryData | null }) {
  const sides = radarSides(data?.radar ?? null);
  return (
    <div
      className="flex h-full w-full items-center justify-between"
      style={{ opacity: sides.off ? 0.35 : 1 }}
      role="img"
      aria-label={radarLabel(sides)}
    >
      <LedBox letter="L" lit={sides.left.count > 0} />
      <LedBox letter="R" lit={sides.right.count > 0} />
    </div>
  );
}
