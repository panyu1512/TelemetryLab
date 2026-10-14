import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { CLASS_RAMP } from "./classColors";

/*
 * The class palette lives in two places: `CLASS_RAMP`, for the components that
 * draw a class colour inline, and the `--color-class-1…5` design tokens in
 * styles.css, for everything that reads it from CSS. This holds them together,
 * so a retune of one cannot quietly leave the other behind.
 */
describe("class colour tokens", () => {
  const css = readFileSync(
    fileURLToPath(new URL("../styles.css", import.meta.url)),
    "utf8",
  );

  it("declares one token per ramp entry, with the ramp's value", () => {
    CLASS_RAMP.forEach((color, i) => {
      const m = css.match(new RegExp(`--color-class-${i + 1}:\\s*(#[0-9a-f]{6})`, "i"));
      expect(m, `--color-class-${i + 1}`).not.toBeNull();
      expect(m![1].toLowerCase()).toBe(color.toLowerCase());
    });
  });

  it("aliases each token under the short --class-N name", () => {
    CLASS_RAMP.forEach((_, i) => {
      expect(css).toContain(`--class-${i + 1}: var(--color-class-${i + 1});`);
    });
  });
});
