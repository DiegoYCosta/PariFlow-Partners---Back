import { Module } from '@nestjs/common';
import { PrismaModule } from './infra/database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { ClientCompaniesModule } from './modules/client-companies/client-companies.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EntityTagsModule } from './modules/entity-tags/entity-tags.module';
import { EmploymentLinksModule } from './modules/employment-links/employment-links.module';
import { HealthModule } from './modules/health/health.module';
import { NetworkModule } from './modules/network/network.module';
import { OccurrencesModule } from './modules/occurrences/occurrences.module';
import { PeopleModule } from './modules/people/people.module';
import { ProviderCompaniesModule } from './modules/provider-companies/provider-companies.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    CalendarModule,
    DashboardModule,
    ProviderCompaniesModule,
    ClientCompaniesModule,
    ContractsModule,
    EntityTagsModule,
    AttachmentsModule,
    OccurrencesModule,
    NetworkModule,
    PeopleModule,
    EmploymentLinksModule,
    ReportsModule
  ]
})
export class AppModule {}
