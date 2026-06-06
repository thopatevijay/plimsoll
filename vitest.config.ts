import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests (kernel, weights, normalizer) are pure + fast and run on every
    // commit. Integration tests that touch the network/chain are gated behind a
    // LIVE env flag so the default `npm test` stays offline and deterministic.
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
