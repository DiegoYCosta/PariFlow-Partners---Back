import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { env } from '../../config/env';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: {
        db: {
          url:
            env.DATABASE_URL ??
            'mysql://root:root@127.0.0.1:3306/pariflow_partners'
        }
      }
    });

    if (!env.DATABASE_URL) {
      this.logger.warn(
        'DATABASE_URL nao configurada. Endpoints de dominio que usam Prisma retornarao indisponibilidade ate o banco ser configurado.'
      );
    }
  }

  assertConfigured(): void {
    if (!env.DATABASE_URL) {
      throw new ServiceUnavailableException(
        'DATABASE_URL nao configurada para este ambiente.'
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
