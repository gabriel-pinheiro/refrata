import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["refrata-*/src/**/*.test.ts", "refrata-*/src/**/*.test.tsx"],
  },
});
