import { Module } from '@nestjs/common';
import { PrismaModule } from './infra/database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClientCompaniesModule } from './modules/client-companies/client-companies.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { EmploymentLinksModule } from './modules/employment-links/employment-links.module';
import { HealthModule } from './modules/health/health.module';
import { PeopleModule } from './modules/people/people.module';
import { ProviderCompaniesModule } from './modules/provider-companies/provider-companies.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    ProviderCompaniesModule,
    ClientCompaniesModule,
    ContractsModule,
    PeopleModule,
    EmploymentLinksModule
  ]
})
export class AppModule {}
