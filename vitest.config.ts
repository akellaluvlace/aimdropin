import path from "node:path";
import { defineConfig } from "vitest/config";

// Phase 5 / A2 - Vitest port of scripts/bench-*.mjs. Each test file mirrors
// the inlined logic of its bench sibling so we keep the parallel-bench
// tradition (CLAUDE.md "no test harnesses unless asked" - these tests are
// developer-introspection at parity with benches, not a CI gate yet).
export default defineConfig({
  // Same "@/…" alias as tsconfig, so modules that import app code can be
  // tested directly.
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
