import { defineConfig, configDefaults } from "vitest/config";

/**
 * Default unit-test run covers pure logic only (CLAUDE.md: UI correctness is
 * never tested). Ink-render `.tsx` tests are excluded here and run explicitly
 * via `npm run test:ink` (see vitest.ink.config.ts).
 */
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "**/*.test.tsx"],
    /**
     * One test file at a time.
     *
     * The default is a worker per core, which is right on a server and wrong
     * here: this project is developed on a phone, where eight of them at once is
     * the memory spike that gets the process killed. Serial is slower in theory
     * and faster in practice, because the machine is swapping long before it is
     * CPU-bound.
     */
    fileParallelism: false,
  },
});
