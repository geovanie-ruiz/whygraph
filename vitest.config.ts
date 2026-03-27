import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/cli/index.ts",
        "src/mcp/index.ts",
        "src/**/*.d.ts",
      ],
      reportsDirectory: "./coverage",
    },
  },
});
