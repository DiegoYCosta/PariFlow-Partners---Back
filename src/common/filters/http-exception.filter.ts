import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';

type ErrorPayload = {
  code?: string;
  message?: string | string[];
  error?: string;
  details?: unknown[];
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const reply = ctx.getResponse<FastifyReply>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const response =
      exception instanceof HttpException
        ? (exception.getResponse() as ErrorPayload | string)
        : null;

    const message =
      typeof response === 'string'
        ? response
        : Array.isArray(response?.message)
          ? response.message.join(', ')
          : response?.message ??
            (exception instanceof Error
              ? exception.message
              : 'Erro interno do servidor.');

    const code =
      typeof response === 'string'
        ? this.buildCodeFromStatus(status)
        : response?.code ?? response?.error ?? this.buildCodeFromStatus(status);

    const details =
      typeof response === 'string'
        ? []
        : response?.details ?? (Array.isArray(response?.message) ? response.message : []);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(message, exception instanceof Error ? exception.stack : undefined);
    }

    // code e traceId precisam seguir previsiveis para o front tratar erro
    // sem parse especial por modulo e sem perder rastreabilidade.
    reply.status(status).send({
      error: {
        code,
        message,
        details,
        traceId: request.id
      }
    });
  }

  private buildCodeFromStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'ACCESS_DENIED';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.NOT_IMPLEMENTED:
        return 'NOT_IMPLEMENTED';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SERVICE_UNAVAILABLE';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
