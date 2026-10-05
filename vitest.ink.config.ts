import { defineConfig } from "vitest/config";

/**
 * Opt-in suite for the ink-render (`*.test.tsx`) component tests that the
 * default run excludes. Run with `npm run test:ink`. UI is still never part of
 * the default/CI gate — this exists only so the legacy kit tests stay usable.
 */
export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.tsx"],
  },
});
