import { execSync } from 'node:child_process';
import path from 'node:path';

// Push the Prisma schema to the isolated Postgres test database before the suite runs.
// TEST_DATABASE_URL must point at a SEPARATE database (e.g. a Neon branch) — the suite
// resets data, so it must never be the production DATABASE_URL.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Point it at a dedicated Postgres test database ' +
        '(e.g. a Neon branch) — see backend/.env.example.',
    );
  }
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
