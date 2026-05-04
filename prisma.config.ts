if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch (error) {
    const errorCode =
      error instanceof Error && 'code' in error
        ? String(error.code)
        : undefined;

    if (errorCode !== 'ENOENT') {
      throw error;
    }
  }
}

import { defineConfig } from 'prisma/config';
import { buildDatabaseUrlFromEnv } from './src/config/database-url';

const databaseUrl = buildDatabaseUrlFromEnv();

if (databaseUrl && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = databaseUrl;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts'
  }
});
