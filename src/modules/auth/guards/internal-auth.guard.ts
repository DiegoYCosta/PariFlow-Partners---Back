import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FastifyRequest } from 'fastify';
import { env } from '../../../config/env';
import { AuthTokenPayload } from '../interfaces/auth-token-payload.interface';

type AuthenticatedRequest = FastifyRequest & {
  user?: AuthTokenPayload;
};

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    // O front fala com os modulos internos sempre por Bearer do access token.
    // Quando refresh entrar de vez, o formato do header continua este.
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de acesso nao informado.');
    }

    const token = authorization.replace('Bearer ', '').trim();

    try {
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(token, {
        secret: env.JWT_ACCESS_SECRET
      });

      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token de acesso invalido ou expirado.');
    }
  }
}
