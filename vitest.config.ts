import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // scripts/ tests cover the data-writing scripts (RFC #45).
    include: ["lib/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
