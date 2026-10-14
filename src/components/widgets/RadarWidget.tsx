import type { TelemetryData } from "../../hooks/useTelemetry";
import {
  CAR_LENGTH_M,
  CAR_WIDTH_M,
  LANE_M,
  VIEW_M,
  gapText,
  placeCar,
  radarCall,
  type PlacedCar,
} from "../../lib/radar";

/*
 * The radar is drawn in metres: one SVG unit is one metre of track, ahead is
 * up, and the scale is the same both ways, so the angle a car sits at on the
 * screen is the angle printed under it. Portrait, because the track runs
 * further than it is wide.
 */
const HALF_W = 2 * LANE_M + CAR_WIDTH_M / 2 + 1.6;
const VIEW_BOX = `${-HALF_W} ${-VIEW_M} ${HALF_W * 2} ${VIEW_M * 2}`;

/**
 * Distance guides, metres: a ring at 5, inside the window's width, and ticks
 * on the centre line at 10, where a ring would be clipped by the sides.
 */
const RING_M = 5;
const TICK_M = 10;

const DANGER = "var(--color-danger)";
const PLAYER = "var(--color-primary)";
const TRAFFIC = "rgb(255 255 255 / 0.5)";
const GUIDE = "rgb(255 255 255 / 0.09)";

const LABEL_FONT = "clamp(0.45rem, 6cqmin, 0.65rem)";
const CALL_FONT = "clamp(0.7rem, 11cqmin, 1.35rem)";
const SIDE_FONT = "clamp(0.6rem, 8cqmin, 1rem)";

function Car({ x, y, fill }: { x: number; y: number; fill: string }) {
  return (
    <rect
      x={x - CAR_WIDTH_M / 2}
      y={-y - CAR_LENGTH_M / 2}
      width={CAR_WIDTH_M}
      height={CAR_LENGTH_M}
      rx={0.45}
      fill={fill}
    />
  );
}

/** The lit strip on one edge: one bar per car the spotter calls on that side. */
function SideBar({ side, count }: { side: "left" | "right"; count: number }) {
  const dir = side === "left" ? -1 : 1;
  const bars = Math.max(1, count);
  return (
    <g>
      {Array.from({ length: bars }, (_, i) => {
        const x = dir * (HALF_W - 0.35 - i * 0.6);
        return (
          <rect
            key={i}
            x={x - 0.2}
            y={-CAR_LENGTH_M}
            width={0.4}
            height={CAR_LENGTH_M * 2}
            rx={0.2}
            fill={count > 0 ? DANGER : GUIDE}
          />
        );
      })}
    </g>
  );
}

/** A dashed line from your car to the one alongside, with its angle at the end. */
function Bearing({ placed }: { placed: PlacedCar }) {
  if (placed.x === null || placed.bearing === null || placed.beyondView) return null;
  const ahead = placed.y >= 0;
  return (
    <g>
      <line
        x1={0}
        y1={0}
        x2={placed.x}
        y2={-placed.y}
        stroke={DANGER}
        strokeWidth={0.12}
        strokeDasharray="0.4 0.3"
      />
      {/* At the car's far end — its nose when it is ahead, its tail when it
          is behind — clear of the line, and never beside it, which is where a
          second car on that side would be. */}
      <text
        x={placed.x}
        y={ahead ? -placed.y - CAR_LENGTH_M / 2 - 0.35 : -placed.y + CAR_LENGTH_M / 2 + 0.35}
        dominantBaseline={ahead ? "auto" : "hanging"}
        textAnchor="middle"
        fontSize={1.25}
        fontWeight={700}
        fill={DANGER}
        className="tnum"
      >
        {placed.bearing}°
      </text>
    </g>
  );
}

/** A car within range but off the drawn window: a chevron and its distance. */
function EdgeMarker({ placed }: { placed: PlacedCar }) {
  const ahead = placed.y > 0;
  // The chevron's tip sits on the edge and points the way the car is.
  const tip = ahead ? -VIEW_M + 0.5 : VIEW_M - 0.5;
  const base = ahead ? tip + 0.9 : tip - 0.9;
  return (
    <g fill={TRAFFIC}>
      <path d={`M ${-0.9} ${base} L 0 ${tip} L ${0.9} ${base} Z`} />
      <text
        x={1.3}
        y={(tip + base) / 2}
        dominantBaseline="central"
        fontSize={1.1}
        fontWeight={700}
        className="tnum"
      >
        {Math.round(Math.abs(placed.y))} m
      </text>
    </g>
  );
}

/** Under the radar, one side: the angle and gap of the car right next to you. */
function SideReadout({
  side,
  count,
  placed,
}: {
  side: "left" | "right";
  count: number;
  placed: PlacedCar | null;
}) {
  const lit = count > 0;
  return (
    <div
      className={`flex min-w-0 flex-col gap-0.5 ${side === "left" ? "items-start text-left" : "items-end text-right"}`}
    >
      <span
        className="tnum max-w-full truncate font-semibold leading-none"
        style={{ fontSize: SIDE_FONT, color: lit ? DANGER : undefined }}
      >
        {lit && placed?.bearing != null ? `${placed.bearing}°` : "—"}
      </span>
      <span
        className="tnum max-w-full truncate font-mono font-medium uppercase tracking-[0.12em] text-faint"
        style={{ fontSize: LABEL_FONT }}
      >
        {lit && placed ? gapText(placed.y) : side}
      </span>
    </div>
  );
}

export function RadarWidget({ data }: { data: TelemetryData | null }) {
  const radar = data?.radar ?? null;
  const call = radarCall(radar);
  const off = !radar || radar.state === "off";
  const occupied = call.left + call.right > 0;

  const placed = (radar?.cars ?? []).map((c) => placeCar(c));
  const inView = placed.filter((p) => !p.beyondView);
  // Only the nearest car past each edge: a queue of chevrons says less than one.
  const nearestBeyond = (ahead: boolean) =>
    placed
      .filter((p) => p.beyondView && p.y > 0 === ahead)
      .sort((a, b) => Math.abs(a.y) - Math.abs(b.y))[0];
  const edges = [nearestBeyond(true), nearestBeyond(false)].filter(
    (p): p is PlacedCar => p !== undefined,
  );

  return (
    <div className="flex h-full flex-col gap-1.5">
      {/* The call, the way the spotter would say it. On top, on its own line:
          it is the one word to read, and "BOTH SIDES" needs the width. */}
      <span
        className={`shrink-0 truncate text-center font-semibold leading-none tracking-tight ${occupied ? "" : off ? "text-faint" : "text-muted"}`}
        style={{ fontSize: CALL_FONT, color: occupied ? DANGER : undefined }}
      >
        {call.label}
      </span>
      <svg
        viewBox={VIEW_BOX}
        preserveAspectRatio="xMidYMid meet"
        className="min-h-0 w-full flex-1"
        style={{ opacity: off ? 0.4 : 1 }}
        role="img"
        aria-label={`Radar: ${call.label}`}
      >
        <circle cx={0} cy={0} r={RING_M} fill="none" stroke={GUIDE} strokeWidth={0.08} />
        {[-TICK_M, TICK_M].map((y) => (
          <line key={y} x1={-0.8} y1={y} x2={0.8} y2={y} stroke={GUIDE} strokeWidth={0.12} />
        ))}
        {/* The abeam line: a car on it is level with you. */}
        <line x1={-HALF_W} y1={0} x2={HALF_W} y2={0} stroke={GUIDE} strokeWidth={0.08} />

        <SideBar side="left" count={call.left} />
        <SideBar side="right" count={call.right} />

        {inView.map((p) => (
          <Car
            key={p.car.carIdx}
            // A car with no side is ahead or behind, and drawn in your lane:
            // iRacing has not said it is anywhere else.
            x={p.x ?? 0}
            y={p.y}
            fill={p.x !== null ? DANGER : TRAFFIC}
          />
        ))}
        {edges.map((p) => (
          <EdgeMarker key={p.car.carIdx} placed={p} />
        ))}

        {/* Under your car, so the bearing reads as leaving its edge. */}
        {call.leftCar && <Bearing placed={call.leftCar} />}
        {call.rightCar && <Bearing placed={call.rightCar} />}

        <Car x={0} y={0} fill={PLAYER} />
      </svg>

      <div className="flex shrink-0 items-end justify-between gap-2">
        <SideReadout side="left" count={call.left} placed={call.leftCar} />
        <SideReadout side="right" count={call.right} placed={call.rightCar} />
      </div>
    </div>
  );
}
