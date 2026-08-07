import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Honours the `@/*` alias from tsconfig.json.
    tsconfigPaths: true,
  },
  test: {
    // Unit and component tests only. The database suite (`test:db`) and the
    // Playwright suite (`test:e2e`) run against the local Supabase stack and
    // have their own runners.
    include: ["{app,components,lib}/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
