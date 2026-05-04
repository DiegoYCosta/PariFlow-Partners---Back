import { env } from '../../config/env';

function apiAuthCookiePath() {
  const prefix = env.API_PREFIX.replace(/^\/+|\/+$/g, '');
  return `/${prefix}/auth`;
}

export function buildRefreshCookieOptions(): {
  domain?: string;
  httpOnly: true;
  sameSite: 'lax';
  path: string;
  secure: boolean;
} {
  // O refresh fica preso ao escopo de auth de proposito.
  // Se o prefixo da API mudar, alinhar isso junto para nao quebrar a renovacao silenciosa.
  return {
    domain: env.COOKIE_DOMAIN,
    httpOnly: true,
    sameSite: 'lax',
    path: apiAuthCookiePath(),
    secure: env.COOKIE_SECURE
  };
}
