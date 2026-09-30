import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    alias: {
      "@": path.resolve(import.meta.dirname, "./"),
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["lib/**/*.ts"],
    },
    projects: [
      {
        test: {
          name: "components",
          environment: "jsdom",
          setupFiles: ["./tests/setup.ts"],
          include: [
            "components/**/*.{test,spec}.{ts,tsx}",
            "tests/unit/components/**/*.{test,spec}.{ts,tsx}",
            "tests/unit/hooks/**/*.{test,spec}.{ts,tsx}",
            "app/**/*.{test,spec}.{ts,tsx}",
          ],
        },
      },
      {
        test: {
          name: "lib",
          environment: "node",
          include: [
            "lib/**/*.{test,spec}.ts",
            "tests/unit/**/*.{test,spec}.ts",
          ],
          exclude: [
            "tests/unit/hooks/**/*.{test,spec}.ts",
          ],
        },
      },
    ],
  },
});
