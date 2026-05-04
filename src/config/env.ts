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

const optionalStringFromEnv = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  return value;
}, z.string().min(1).optional());

const optionalEmailFromEnv = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  return value;
}, z.string().email().optional());

const optionalUrlListFromEnv = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return items.length > 0 ? items : undefined;
}, z.array(z.string().url()).optional());

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_NAME: z.string().min(1).default('pariflow-back'),
  APP_URL: z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() === '') {
      return undefined;
    }

    return value;
  }, z.string().url().optional()),
  CORS_ORIGINS: optionalUrlListFromEnv,
  API_PREFIX: z.string().min(1).default('api/v1'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'log', 'debug', 'verbose'])
    .default('log'),
  DATABASE_URL: optionalStringFromEnv,
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
  COOKIE_DOMAIN: optionalStringFromEnv,
  COOKIE_SECURE: booleanFromEnv.default(false),
  DEV_AUTH_BYPASS: booleanFromEnv.default(false),
  FIREBASE_PROJECT_ID: optionalStringFromEnv,
  FIREBASE_CLIENT_EMAIL: optionalStringFromEnv,
  FIREBASE_PRIVATE_KEY: optionalStringFromEnv,
  AWS_REGION: z.string().min(1).default('sa-east-1'),
  S3_BUCKET_PRIVATE: optionalStringFromEnv,
  SENSITIVE_SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  SEED_ADMIN_NAME: optionalStringFromEnv,
  SEED_ADMIN_EMAIL: optionalEmailFromEnv,
  SEED_ADMIN_FIREBASE_UID: optionalStringFromEnv,
  SEED_ENABLE_SAMPLE_DATA: booleanFromEnv.default(false)
});

export type Env = z.infer<typeof environmentSchema>;
export const env: Env = environmentSchema.parse(process.env);
