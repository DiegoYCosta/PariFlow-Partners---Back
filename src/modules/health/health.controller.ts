import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { env } from '../../config/env';
import { PrismaService } from '../../infra/database/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: 'Retorna o status basico da aplicacao.'
  })
  getHealth() {
    return {
      status: 'ok',
      app: env.APP_NAME,
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString()
    };
  }

  @Get('live')
  @ApiOperation({
    summary: 'Retorna liveness sem depender do banco de dados.'
  })
  getLiveness() {
    return {
      status: 'ok',
      app: env.APP_NAME,
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString()
    };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Valida se a aplicacao esta pronta para receber trafego real.'
  })
  async getReadiness() {
    const startedAt = Date.now();

    try {
      this.prisma.assertConfigured();
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok',
        app: env.APP_NAME,
        environment: env.NODE_ENV,
        checks: {
          database: {
            status: 'ok',
            latencyMs: Date.now() - startedAt
          }
        },
        timestamp: new Date().toISOString()
      };
    } catch {
      throw new ServiceUnavailableException({
        code: 'READINESS_CHECK_FAILED',
        message: 'Aplicacao ainda nao esta pronta para receber trafego.',
        details: [
          {
            dependency: 'database',
            status: env.DATABASE_URL ? 'unavailable' : 'not_configured'
          }
        ]
      });
    }
  }
}
