import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

@Injectable()
export class PublicOnboardingRateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const ip = this.clientIp(request);
    const limit = request.method === 'POST' ? 10 : 60;
    const windowMs = 60_000;
    const key = `${ip}:${request.method}:${request.url.split('?')[0]}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      this.cleanup(now);
      return true;
    }

    bucket.count += 1;
    if (bucket.count > limit) {
      throw new HttpException(
        'Muitas tentativas no cadastro publico. Aguarde um minuto e tente novamente.',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    return true;
  }

  private clientIp(request: FastifyRequest) {
    const forwardedFor = request.headers['x-forwarded-for'];
    const rawValue = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor;
    const forwardedIp = rawValue?.split(',')[0]?.trim();

    return forwardedIp || request.ip || 'unknown';
  }

  private cleanup(now: number) {
    if (buckets.size < 2000) {
      return;
    }

    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }
}
