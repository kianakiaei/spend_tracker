import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Two projects (ticket 11): node for domain + integration, jsdom for components.
// Per-glob coverage thresholds are added per-module with tickets 19-24 (final
// closeout in ticket 30) — @vitest/coverage-v8 is installed already.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: [
            "tests/unit/**/*.test.{ts,tsx}",
            "tests/integration/**/*.test.ts",
          ],
        },
      },
      {
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["tests/components/**/*.test.tsx"],
          setupFiles: ["./tests/setup.components.ts"],
        },
      },
    ],
  },
});
