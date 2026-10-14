import type { TelemetryData } from "../../hooks/useTelemetry";
import {
  PLAYER_SPAN,
  overlap,
  radarLabel,
  radarLines,
  type LineSpan,
  type RadarLane,
  type RadarSide,
} from "../../lib/radar";

/*
 * The radar is two lines and nothing else: no panel, no header, no map, no
 * numbers. Each line runs down one edge of the window, and the window is the
 * stretch of track beside your car — ahead at the top, behind at the bottom
 * (`lib/radar.ts`). Size it to sit either side of your car on screen and the
 * lines read as the edges of your own field of view.
 *
 * Three marks, all flat and square-ended:
 *  - a hairline the full height of each line, so the window can be placed;
 *  - your car's stretch of it, a little stronger, the reference everything
 *    else is read against;
 *  - a car alongside, lit over the stretch it covers: `danger` while it
 *    overlaps you, `warning` once it is clear by a nose. A second car on the
 *    same side lights a second line beyond the first.
 */

const DANGER = "var(--color-danger)";
const WARNING = "var(--color-warning)";
const RAIL = "var(--color-chart-axis)";
const PLAYER = "var(--color-chart-tertiary)";

/** Line thickness and lane spacing, fluid with the window, in container units. */
const LINE_W = "clamp(3px, 3cqw, 9px)";

/** A dark edge so a lit line still reads over a red car or a sunlit kerb. */
const EDGE = "0 0 0 1px rgb(0 0 0 / 0.45)";

function Span({
  span,
  color,
  opacity = 1,
  edge = false,
}: {
  span: LineSpan;
  color: string;
  opacity?: number;
  edge?: boolean;
}) {
  return (
    <div
      className="absolute inset-x-0"
      style={{
        top: `${span.top * 100}%`,
        height: `${(span.bottom - span.top) * 100}%`,
        background: color,
        opacity,
        boxShadow: edge ? EDGE : undefined,
      }}
    />
  );
}

function laneColor(lane: RadarLane): string {
  return lane.car && overlap(lane.car.gapM) === 0 ? WARNING : DANGER;
}

/** One line: lane 1 carries the rail and your car; lane 2 only ever a car. */
function Line({ lane, inside }: { lane: RadarLane | undefined; inside: boolean }) {
  return (
    <div className="relative h-full" style={{ width: LINE_W }}>
      {inside && (
        <>
          <div
            className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2"
            style={{ background: RAIL }}
          />
          <Span span={PLAYER_SPAN} color={PLAYER} opacity={0.7} />
        </>
      )}
      {lane && (
        <Span
          span={lane.span}
          color={laneColor(lane)}
          // The sim said "alongside" but not where: lit, but not as sure.
          opacity={lane.estimated ? 0.55 : 1}
          edge
        />
      )}
    </div>
  );
}

function Side({ side, which }: { side: RadarSide; which: "left" | "right" }) {
  // Lane 1 is the line nearest your car, lane 2 the one beyond it — so on the
  // left the outer line comes first.
  const inner = <Line key="1" lane={side.lanes[0]} inside />;
  const outer = <Line key="2" lane={side.lanes[1]} inside={false} />;
  return (
    <div
      className={`absolute inset-y-0 flex ${which === "left" ? "left-0" : "right-0"}`}
      style={{ gap: LINE_W }}
    >
      {which === "left" ? [outer, inner] : [inner, outer]}
    </div>
  );
}

export function RadarWidget({ data }: { data: TelemetryData | null }) {
  const lines = radarLines(data?.radar ?? null);
  return (
    <div
      className="relative h-full w-full"
      style={{ opacity: lines.off ? 0.35 : 1 }}
      role="img"
      aria-label={radarLabel(lines)}
    >
      <Side side={lines.left} which="left" />
      <Side side={lines.right} which="right" />
    </div>
  );
}
