/**
 * The key under the timing tower: what every colour, ring, line and chip on it
 * means. A Manager toggle, off by default for the reason the column labels
 * are — it teaches the table once, and after that it is a strip the driver
 * reads past every lap.
 *
 * Every entry pairs a swatch with words, and every state is shown by its glyph
 * and word as well as its colour, so the legend itself is readable without
 * colour vision.
 */

import type { ReactNode } from "react";
import { tint } from "../../lib/contrast";
import { TOWER } from "../../lib/towerPalette";
import type { CompoundLook } from "../../lib/tyreCompound";
import { TyreRing } from "./cells";
import {
  BattleGlyph,
  ChequerGlyph,
  FlagGlyph,
  OffTrackGlyph,
  OutGlyph,
  WrenchGlyph,
} from "./glyphs";

const TYRES: CompoundLook[] = [
  { kind: "soft", letter: "S", label: "Soft" },
  { kind: "medium", letter: "M", label: "Medium" },
  { kind: "hard", letter: "H", label: "Hard" },
  { kind: "wet", letter: "", label: "Wet" },
];

function Item({ swatch, children }: { swatch: ReactNode; children: ReactNode }) {
  return (
    <span className="flex shrink-0 items-center gap-2">
      {swatch}
      {children}
    </span>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-[18px] gap-y-1.5">
      <span
        className="w-[88px] shrink-0 text-[11px] font-semibold tracking-[0.1em]"
        style={{ color: TOWER.text3 }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function Square({ background, ring }: { background: string; ring?: string }) {
  return (
    <span
      className="size-[14px] shrink-0 rounded-[3px]"
      style={{ background, boxShadow: ring ? `inset 0 0 0 1px ${ring}` : undefined }}
    />
  );
}

function GlyphChip({
  background,
  ink,
  children,
}: {
  background: string;
  ink: string;
  children: ReactNode;
}) {
  return (
    <span
      className="flex h-5 w-[22px] shrink-0 items-center justify-center rounded-[4px]"
      style={{ background, color: ink }}
    >
      {children}
    </span>
  );
}

export function TowerLegend({ accent }: { accent: string }) {
  return (
    <div
      className="flex flex-col gap-1.5 text-[13px]"
      style={{ padding: "0 16px", color: TOWER.text2 }}
    >
      <Group label="TIMES">
        <Item swatch={<Square background={TOWER.classBest} />}>Class best</Item>
        <Item
          swatch={<Square background={TOWER.personalBestTint} ring={TOWER.personalBestRing} />}
        >
          Personal best
        </Item>
        <Item swatch={<span className="font-semibold" style={{ color: TOWER.slower }}>+0.4</span>}>
          Well off own best
        </Item>
        <Item swatch={<span style={{ color: TOWER.text2 }}>+0.1</span>}>Delta to own best sector</Item>
        <Item
          swatch={
            <span
              className="flex items-center gap-1 rounded-[4px] px-1.5 py-px font-semibold"
              style={{ background: tint(accent, 0.24), color: TOWER.text }}
            >
              <BattleGlyph />
              +0.2
            </span>
          }
        >
          Within 1 s of the car ahead in class
        </Item>
      </Group>

      <Group label="TYRES">
        {TYRES.map((look) => (
          <Item key={look.kind} swatch={<TyreRing look={look} />}>
            {look.label}
          </Item>
        ))}
        <Item swatch={<span style={{ color: TOWER.text3 }}>16L</span>}>Laps on the set</Item>
        <Item
          swatch={
            <svg width="52" height="18" viewBox="0 0 52 18" aria-hidden>
              <line x1="2" y1="13.4" x2="50" y2="13.4" stroke={TOWER.divider} strokeDasharray="2 2" />
              <polyline
                points="3,12.3 14.5,13.4 26,11.1 37.5,9.2 49,7"
                fill="none"
                stroke={TOWER.text2}
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx="49" cy="7" r="2.25" fill={TOWER.text} stroke={TOWER.text2} strokeWidth="1.25" />
            </svg>
          }
        >
          Last 5 laps · dotted = own best · higher = slower
        </Item>
        <span className="ml-auto">
          <Item swatch={<Square background={TOWER.meBg} ring={TOWER.meRing} />}>Your car</Item>
        </span>
      </Group>

      <Group label="STATES">
        <Item
          swatch={
            <span
              className="tower-cond flex h-5 items-center rounded-[3px] px-[7px] text-[14px] font-bold leading-none tracking-[0.1em]"
              style={{ background: TOWER.pit, color: TOWER.onPit }}
            >
              PIT
            </span>
          }
        >
          In the pit lane · live timing greyed
        </Item>
        <Item
          swatch={
            <GlyphChip background={TOWER.cautionTint} ink={TOWER.caution}>
              <OffTrackGlyph />
            </GlyphChip>
          }
        >
          Off track
        </Item>
        <Item
          swatch={
            <GlyphChip background={TOWER.cautionTint} ink={TOWER.caution}>
              <WrenchGlyph />
            </GlyphChip>
          }
        >
          Damage · meatball
        </Item>
        <Item
          swatch={
            <GlyphChip background={TOWER.disconnectedTint} ink={TOWER.disconnected}>
              <OutGlyph />
            </GlyphChip>
          }
        >
          Out · disconnected or towing
        </Item>
        <Item
          swatch={
            <span
              className="tower-cond flex h-5 items-center rounded-[4px] px-[5px] text-[14px] font-bold leading-none tracking-[0.04em]"
              style={{ background: TOWER.dsq, color: TOWER.onDsq }}
            >
              DSQ
            </span>
          }
        >
          Disqualified · name struck
        </Item>
        <Item
          swatch={
            <GlyphChip background={TOWER.finalLapTint} ink={TOWER.finalLap}>
              <FlagGlyph />
            </GlyphChip>
          }
        >
          Final lap
        </Item>
        <Item
          swatch={
            <GlyphChip background={TOWER.finalLapTint} ink={TOWER.finalLap}>
              <ChequerGlyph />
            </GlyphChip>
          }
        >
          Finished
        </Item>
      </Group>
    </div>
  );
}
