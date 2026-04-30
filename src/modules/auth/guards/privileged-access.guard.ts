import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { AuthTokenPayload } from '../interfaces/auth-token-payload.interface';

type AuthenticatedRequest = FastifyRequest & {
  user?: AuthTokenPayload;
};

@Injectable()
export class PrivilegedAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Contexto de acesso nao encontrado.');
    }

    if (
      user.securityContext !== 'privileged' &&
      user.securityContext !== 'sensitive_verified' &&
      user.securityContext !== 'critical_verified'
    ) {
      // Nao deixar o front inferir liberacao por nome de cargo solto.
      // O gate real continua sendo o securityContext calculado no backend.
      throw new ForbiddenException(
        'Perfil interno ainda nao habilitado para este modulo.'
      );
    }

    return true;
  }
}
