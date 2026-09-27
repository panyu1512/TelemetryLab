/**
 * Per-class colours — the driver's own pick for each class in the session, for
 * the standings tower, the relative and the broadcast tower alike.
 *
 * The ramp in `lib/classColors` is chosen so no class lands on a colour the
 * tower already spends on a meaning. A pick here can: the driver may know their
 * league's colours better than the ramp does. So the panel warns rather than
 * refuses — naming the status the pick would be mistaken for — and a reset puts
 * the class back on the ramp.
 *
 * Keyed by class short name, so a colour picked for GT3 follows GT3 into the
 * next session wherever it sorts. Writes to {@link useClassColorsStore}, which
 * persists and broadcasts, so open overlay windows repaint at once.
 */

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useSessionStore } from "../../stores/useSessionStore";
import { useClassColorsStore } from "../../stores/useClassColorsStore";
import {
  CLASS_RAMP,
  classColorClash,
  resolveClassColor,
} from "../../lib/classColors";
import { towerInk } from "../../lib/towerPalette";
import { IconButton } from "../ui/controls";

const RAMP_NAMES = ["cyan", "magenta", "lime", "violet", "teal"];

/** A colour input needs a plain hex; the sixth-class fallback is a color-mix(). */
function asHex(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "#888888";
}

export function ClassColorsPanel() {
  const classes = useSessionStore((s) => s.session?.classes ?? []);
  const overrides = useClassColorsStore((s) => s.overrides);
  const setClassColor = useClassColorsStore((s) => s.setClassColor);

  // Classes in this session first, in the order the tower stacks them, then
  // any the driver has coloured before that are not racing today.
  const names = classes.map((c) => c.shortName).filter(Boolean);
  const absent = Object.keys(overrides).filter((n) => !names.includes(n));

  if (names.length === 0 && absent.length === 0) {
    return (
      <p className="text-[11px] text-faint">
        The classes appear here once a session is running — start one in iRacing, or turn on
        Mock Data in Global Settings.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {[...names, ...absent].map((name, i) => {
        const inSession = i < names.length;
        const color = resolveClassColor(inSession ? i : 0, name, overrides);
        const picked = overrides[name] != null;
        const clash = classColorClash(color);
        return (
          <div
            key={name}
            className="rounded-card border border-border bg-surface px-3 py-2.5"
          >
            <div className="flex items-center gap-3">
              <span
                className="min-w-[3.5rem] rounded-[4px] px-2 py-0.5 text-center text-xs font-bold tracking-[0.06em]"
                style={{ background: color, color: towerInk(color) }}
              >
                {name}
              </span>
              <div className="flex items-center gap-1.5" role="group" aria-label={`Colour for ${name}`}>
                {CLASS_RAMP.map((swatch, k) => {
                  const active = color.toLowerCase() === swatch.toLowerCase();
                  return (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => setClassColor(name, swatch)}
                      aria-pressed={active}
                      aria-label={`${RAMP_NAMES[k]} for ${name}`}
                      title={RAMP_NAMES[k]}
                      className={[
                        "size-5 rounded-ctl border transition-colors",
                        active ? "border-text" : "border-border hover:border-border-strong",
                      ].join(" ")}
                      style={{ background: swatch }}
                    />
                  );
                })}
                <label className="relative flex size-5 cursor-pointer items-center justify-center overflow-hidden rounded-ctl border border-dashed border-border-strong text-[10px] text-muted hover:text-text">
                  <span aria-hidden>+</span>
                  <input
                    type="color"
                    value={asHex(color)}
                    onChange={(e) => setClassColor(name, e.target.value)}
                    aria-label={`Custom colour for ${name}`}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
              </div>
              <span className="ml-auto flex items-center gap-2">
                {!inSession && (
                  <span className="text-[11px] text-faint">Not in this session</span>
                )}
                {picked && (
                  <IconButton
                    icon={<RotateCcw className="size-3.5" />}
                    title={`Put ${name} back on the default colour`}
                    size="sm"
                    onClick={() => setClassColor(name, null)}
                  />
                )}
              </span>
            </div>
            {clash && (
              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-warning">
                <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                <span>
                  Close to the colour the tower uses for {clash.meaning} — rows in this class
                  could be misread. A colour further round the wheel reads better.
                </span>
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
