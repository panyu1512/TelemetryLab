import { defineConfig } from "vitest/config";

// The unit suite targets the pure, framework-free logic that powers the
// overlays — formatters, colour scales, the fuel-strategy solver and the wire
// protocol parser. These need no DOM, so we run them in a fast `node`
// environment and keep React/Tailwind out of the test pipeline entirely.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov"],
      // Scope coverage to the logic we actually unit-test, so the number is
      // meaningful instead of diluted by UI/Tauri modules exercised elsewhere.
      include: [
        "src/lib/format.ts",
        "src/lib/classColors.ts",
        "src/lib/lapTimeOrder.ts",
        "src/lib/scales.ts",
        "src/lib/sessionKind.ts",
        "src/lib/tableScale.ts",
        "src/lib/tyreFreshness.ts",
        "src/lib/fuelStrategy.ts",
        "src/telemetry/protocol.ts",
      ],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
