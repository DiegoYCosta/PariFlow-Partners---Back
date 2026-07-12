import 'reflect-metadata';
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { env } from './config/env';

function normalizeOrigin(origin?: string) {
  if (!origin) {
    return undefined;
  }

  try {
    const parsed = new URL(origin);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return undefined;
  }
}

function isLocalDevOrigin(origin?: string) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) {
    return false;
  }

  const parsed = new URL(normalized);
  return (
    (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
    ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname)
  );
}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false,
      trustProxy: env.TRUST_PROXY
    })
  );

  const logger = new Logger('Bootstrap');

  await app.register(cookie as never);
  await app.register(helmet as never, {
    frameguard: {
      action: 'deny'
    },
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    }
  });
  const productionCorsOrigins = env.CORS_ORIGINS ?? (
    env.APP_URL ? [env.APP_URL] : []
  );
  const productionCorsOriginSet = new Set(
    productionCorsOrigins
      .map((origin) => normalizeOrigin(origin))
      .filter((origin): origin is string => Boolean(origin))
  );
  await app.register(cors as never, {
    credentials: true,
    origin:
      env.NODE_ENV === 'production'
        ? productionCorsOrigins.length > 0
          ? (
              origin: string | undefined,
              callback: (error: Error | null, allowed: boolean) => void
            ) => {
              const normalizedOrigin = normalizeOrigin(origin);
              const allowed =
                !origin ||
                (normalizedOrigin !== undefined &&
                  productionCorsOriginSet.has(normalizedOrigin)) ||
                (env.CORS_ALLOW_LOCAL_DEV_ORIGINS &&
                  isLocalDevOrigin(origin));

              callback(null, allowed);
            }
          : false
        : true
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    })
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  // O front entra em cima de /api/v1 desde o primeiro dia. Se houver quebra
  // de contrato depois, o caminho e versionar antes de mexer no prefixo atual.
  app.setGlobalPrefix(env.API_PREFIX, {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET }
    ]
  });
  app.enableShutdownHooks();

  if (env.SWAGGER_ENABLED) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('PariFlow Partners API')
      .setDescription(
        'API interna do PariFlow Partners para autenticacao, cadastros e evolucao dos modulos operacionais.'
      )
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(env.PORT, env.HOST);

  logger.log(`HTTP ativo em http://${env.HOST}:${env.PORT}`);
  if (env.SWAGGER_ENABLED) {
    logger.log(`Swagger ativo em http://${env.HOST}:${env.PORT}/api/docs`);
  } else {
    logger.log('Swagger desabilitado neste ambiente');
  }
}

void bootstrap();
