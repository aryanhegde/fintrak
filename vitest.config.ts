import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  // tsconfig.json sets "jsx": "preserve" for Next.js's own compiler; Vite's
  // oxc transform (used by Vitest for .tsx) needs an explicit override or it
  // leaves JSX untransformed and fails to parse it.
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    include: ["**/__tests__/**/*.test.ts"],
  },
});
