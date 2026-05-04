import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { databaseUrl } from '../../config/env';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: {
        db: {
          url:
            databaseUrl ??
            'mysql://root:root@127.0.0.1:3306/pariflow_partners'
        }
      }
    });

    if (!databaseUrl) {
      this.logger.warn(
        'DATABASE_URL ou DB_HOST/DB_USER/DB_NAME nao configurados. Endpoints de dominio que usam Prisma retornarao indisponibilidade ate o banco ser configurado.'
      );
    }
  }

  assertConfigured(): void {
    if (!databaseUrl) {
      throw new ServiceUnavailableException(
        'Banco de dados nao configurado para este ambiente.'
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
