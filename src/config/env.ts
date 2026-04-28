import { z } from 'zod';

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

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  return value;
}, z.boolean());

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_NAME: z.string().min(1).default('pariflow-back'),
  APP_URL: z.string().url().optional(),
  API_PREFIX: z.string().min(1).default('api/v1'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'log', 'debug', 'verbose'])
    .default('log'),
  DATABASE_URL: z.string().min(1).optional(),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32)
    .default('change-this-access-secret-for-local-development-123'),
  JWT_ACCESS_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32)
    .default('change-this-refresh-secret-for-local-development-123'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(15),
  COOKIE_DOMAIN: z.string().min(1).optional(),
  COOKIE_SECURE: booleanFromEnv.default(false),
  DEV_AUTH_BYPASS: booleanFromEnv.default(false),
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  FIREBASE_CLIENT_EMAIL: z.string().min(1).optional(),
  FIREBASE_PRIVATE_KEY: z.string().min(1).optional(),
  AWS_REGION: z.string().min(1).default('sa-east-1'),
  S3_BUCKET_PRIVATE: z.string().min(1).optional(),
  SENSITIVE_SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  SEED_ADMIN_NAME: z.string().min(1).optional(),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_FIREBASE_UID: z.string().min(1).optional(),
  SEED_ENABLE_SAMPLE_DATA: booleanFromEnv.default(false)
});

export type Env = z.infer<typeof environmentSchema>;
export const env: Env = environmentSchema.parse(process.env);
