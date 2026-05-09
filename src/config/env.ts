import { z } from 'zod';
import { buildDatabaseUrlFromEnv } from './database-url';

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
  HOST: z.string().min(1).default('0.0.0.0'),
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
  DB_HOST: optionalStringFromEnv,
  DB_PORT: z.coerce.number().int().positive().optional(),
  DB_USER: optionalStringFromEnv,
  DB_PASSWORD: optionalStringFromEnv,
  DB_NAME: optionalStringFromEnv,
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
  PREVIEW_AUTH_BYPASS: booleanFromEnv.default(false),
  SWAGGER_ENABLED: booleanFromEnv.optional(),
  TRUST_PROXY: booleanFromEnv.default(false),
  FIREBASE_PROJECT_ID: optionalStringFromEnv,
  FIREBASE_CLIENT_EMAIL: optionalStringFromEnv,
  FIREBASE_PRIVATE_KEY: optionalStringFromEnv,
  AWS_REGION: z.string().min(1).default('sa-east-1'),
  S3_BUCKET_PRIVATE: optionalStringFromEnv,
  SENSITIVE_SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  PUBLIC_SUBMISSIONS_ENABLED: booleanFromEnv.default(false),
  PUBLIC_SUBMISSION_TOKEN: optionalStringFromEnv,
  SEED_ADMIN_NAME: optionalStringFromEnv,
  SEED_ADMIN_EMAIL: optionalEmailFromEnv,
  SEED_ADMIN_FIREBASE_UID: optionalStringFromEnv,
  SEED_ENABLE_SAMPLE_DATA: booleanFromEnv.default(false)
});

type ParsedEnv = z.infer<typeof environmentSchema>;
export type Env = Omit<ParsedEnv, 'SWAGGER_ENABLED'> & {
  SWAGGER_ENABLED: boolean;
};

function assertProductionEnvIsSafe(parsedEnv: ParsedEnv) {
  if (parsedEnv.NODE_ENV !== 'production') {
    return;
  }

  const unsafeSettings: string[] = [];

  if (parsedEnv.DEV_AUTH_BYPASS) {
    unsafeSettings.push('DEV_AUTH_BYPASS=true');
  }

  if (parsedEnv.PREVIEW_AUTH_BYPASS) {
    unsafeSettings.push('PREVIEW_AUTH_BYPASS=true');
  }

  if (parsedEnv.SWAGGER_ENABLED) {
    unsafeSettings.push('SWAGGER_ENABLED=true');
  }

  if (parsedEnv.SEED_ENABLE_SAMPLE_DATA) {
    unsafeSettings.push('SEED_ENABLE_SAMPLE_DATA=true');
  }

  if (parsedEnv.HOST === '0.0.0.0' || parsedEnv.HOST === '::') {
    unsafeSettings.push('HOST publico em producao');
  }

  if (parsedEnv.JWT_ACCESS_SECRET.startsWith('change-this-')) {
    unsafeSettings.push('JWT_ACCESS_SECRET padrao');
  }

  if (parsedEnv.JWT_REFRESH_SECRET.startsWith('change-this-')) {
    unsafeSettings.push('JWT_REFRESH_SECRET padrao');
  }

  if (parsedEnv.JWT_ACCESS_SECRET === parsedEnv.JWT_REFRESH_SECRET) {
    unsafeSettings.push('JWT_ACCESS_SECRET igual a JWT_REFRESH_SECRET');
  }

  if (
    parsedEnv.APP_URL?.startsWith('https://') &&
    parsedEnv.COOKIE_SECURE === false
  ) {
    unsafeSettings.push('COOKIE_SECURE=false com APP_URL HTTPS');
  }

  if (
    parsedEnv.PUBLIC_SUBMISSIONS_ENABLED &&
    !parsedEnv.PUBLIC_SUBMISSION_TOKEN
  ) {
    unsafeSettings.push(
      'PUBLIC_SUBMISSIONS_ENABLED=true sem PUBLIC_SUBMISSION_TOKEN'
    );
  }

  if (unsafeSettings.length > 0) {
    throw new Error(
      `Configuracao insegura para producao: ${unsafeSettings.join(', ')}.`
    );
  }
}

const parsedEnv = environmentSchema.parse(process.env);
assertProductionEnvIsSafe(parsedEnv);

export const env: Env = {
  ...parsedEnv,
  SWAGGER_ENABLED: parsedEnv.SWAGGER_ENABLED ?? parsedEnv.NODE_ENV !== 'production'
};
export const databaseUrl = buildDatabaseUrlFromEnv(env);

if (databaseUrl && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = databaseUrl;
}
