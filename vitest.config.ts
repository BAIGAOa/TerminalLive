import { defineConfig, configDefaults } from "vitest/config";

/**
 * Default unit-test run covers pure logic only (CLAUDE.md: UI correctness is
 * never tested). Ink-render `.tsx` tests are excluded here and run explicitly
 * via `npm run test:ink` (see vitest.ink.config.ts).
 */
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "**/*.test.tsx"],
  },
});
