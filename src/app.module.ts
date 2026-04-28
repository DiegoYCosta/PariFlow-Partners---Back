import { Module } from '@nestjs/common';
import { PrismaModule } from './infra/database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClientCompaniesModule } from './modules/client-companies/client-companies.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { HealthModule } from './modules/health/health.module';
import { ProviderCompaniesModule } from './modules/provider-companies/provider-companies.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    ProviderCompaniesModule,
    ClientCompaniesModule,
    ContractsModule
  ]
})
export class AppModule {}
