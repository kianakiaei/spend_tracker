import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Two projects (ticket 11): node for domain + integration, jsdom for components.
// Per-glob coverage thresholds activate in step with each module (tickets
// 19-24; final closeout in ticket 30). Ticket 19 landed the schema/id/service
// baseline, tickets 20-21 the jalali and categorization globs, ticket 23 the
// recurring glob.
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
    coverage: {
      provider: "v8",
      include: ["src/**", "packages/shared/src/**"],
      thresholds: {
        "src/lib/schemas/**": { lines: 90, branches: 85 },
        "src/lib/id.ts": { lines: 90, branches: 85 },
        "src/lib/jalali/**": { lines: 90, branches: 85 },
        "src/lib/categorization/**": { lines: 90, branches: 85 },
        "src/lib/recurring/**": { lines: 90, branches: 85 },
        "src/lib/services/**": { lines: 80, branches: 80 },
        "packages/shared/src/**": { lines: 90, branches: 85 },
      },
    },
  },
});
