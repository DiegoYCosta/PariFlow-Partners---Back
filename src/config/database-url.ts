type DatabaseUrlEnv = {
  DATABASE_URL?: string;
  DB_HOST?: string;
  DB_PORT?: string | number;
  DB_USER?: string;
  DB_PASSWORD?: string;
  DB_NAME?: string;
};

export function buildDatabaseUrlFromEnv(
  source: DatabaseUrlEnv = process.env
): string | undefined {
  const explicitUrl = source.DATABASE_URL?.trim();
  if (explicitUrl) {
    return explicitUrl;
  }

  const host = source.DB_HOST?.trim();
  const user = source.DB_USER?.trim();
  const database = source.DB_NAME?.trim();

  if (!host || !user || !database) {
    return undefined;
  }

  const port = `${source.DB_PORT ?? 3306}`.trim() || '3306';
  const password = source.DB_PASSWORD ?? '';
  const encodedUser = encodeURIComponent(user);
  const credentials =
    password.length > 0
      ? `${encodedUser}:${encodeURIComponent(password)}`
      : encodedUser;

  return `mysql://${credentials}@${host}:${port}/${database}`;
}
