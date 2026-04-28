import { env } from '../../config/env';

export function buildRefreshCookieOptions(): {
  domain?: string;
  httpOnly: true;
  sameSite: 'lax';
  path: string;
  secure: boolean;
} {
  return {
    domain: env.COOKIE_DOMAIN,
    httpOnly: true,
    sameSite: 'lax',
    path: '/api/v1/auth',
    secure: env.COOKIE_SECURE
  };
}
