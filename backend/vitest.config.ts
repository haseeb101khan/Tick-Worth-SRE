import { defineConfig } from 'vitest/config';

// Tests run against a SEPARATE Postgres database (e.g. a Neon branch), set via
// TEST_DATABASE_URL — never the production DATABASE_URL, since the suite resets data.
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? '';

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'test-secret',
    },
    globalSetup: './tests/globalSetup.ts',
    // Test files share one database — don't run them in parallel.
    fileParallelism: false,
  },
});
