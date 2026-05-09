import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { env } from '../../config/env';

export function assertPublicSubmissionAllowed(token?: string): void {
  if (!env.PUBLIC_SUBMISSIONS_ENABLED) {
    throw new ForbiddenException('Submissoes publicas desabilitadas.');
  }

  if (!env.PUBLIC_SUBMISSION_TOKEN) {
    return;
  }

  if (!token || !constantTimeEquals(token, env.PUBLIC_SUBMISSION_TOKEN)) {
    throw new UnauthorizedException('Token de submissao publica invalido.');
  }
}

function constantTimeEquals(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}
