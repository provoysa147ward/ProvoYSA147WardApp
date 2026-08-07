import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    // These talk to a real Postgres over HTTP and share one database, so they
    // must not run concurrently with each other.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
