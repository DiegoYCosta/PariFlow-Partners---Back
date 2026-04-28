import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { env } from '../../config/env';

@ApiTags('health')
@Controller('health')
export class HealthController {
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
}
