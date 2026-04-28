import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          traceId: request.id
        }
      }))
    );
  }
}
