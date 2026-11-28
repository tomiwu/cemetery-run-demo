import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 30_000,
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/logic/**"],
      exclude: ["src/logic/**/*.test.ts"],
      thresholds: {
        lines: 90,
        branches: 85,
        functions: 90,
        statements: 90,
      },
    },
  },
});
