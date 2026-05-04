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

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false
    })
  );

  const logger = new Logger('Bootstrap');

  await app.register(cookie as never);
  await app.register(helmet as never);
  const productionCorsOrigins = env.CORS_ORIGINS ?? (
    env.APP_URL ? [env.APP_URL] : []
  );
  await app.register(cors as never, {
    credentials: true,
    origin:
      env.NODE_ENV === 'production'
        ? productionCorsOrigins.length > 0
          ? productionCorsOrigins
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PariFlow Partners API')
    .setDescription(
      'API interna do PariFlow Partners para autenticacao, cadastros e evolucao dos modulos operacionais.'
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // Enquanto o front estiver entrando por partes, o Swagger precisa continuar
  // espelhando o contrato real para reduzir ajuste manual e retrabalho.
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(env.PORT, '0.0.0.0');

  logger.log(`HTTP ativo em http://localhost:${env.PORT}`);
  logger.log(`Swagger ativo em http://localhost:${env.PORT}/api/docs`);
}

void bootstrap();
