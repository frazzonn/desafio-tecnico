import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: "postgres://app:app@localhost:5433/conferencia_test",
    },
    fileParallelism: false,
  },
});
