import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      // A `.refrata-fixture` file is JSON, so a test imports a library type as one.
      name: "refrata-fixture",
      transform(code, id) {
        if (!id.endsWith(".refrata-fixture")) return undefined;
        return { code: `export default ${code};`, map: null };
      },
    },
  ],
  test: {
    include: ["refrata-*/src/**/*.test.ts", "refrata-*/src/**/*.test.tsx"],
  },
});
