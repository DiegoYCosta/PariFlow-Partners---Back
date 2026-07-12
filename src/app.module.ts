import { Module } from '@nestjs/common';
import { PrismaModule } from './infra/database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { ClientOnboardingModule } from './modules/client-onboarding/client-onboarding.module';
import { ClientCompaniesModule } from './modules/client-companies/client-companies.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EntityTagsModule } from './modules/entity-tags/entity-tags.module';
import { EmploymentLinksModule } from './modules/employment-links/employment-links.module';
import { FocusBoardModule } from './modules/focus-board/focus-board.module';
import { HealthModule } from './modules/health/health.module';
import { NetworkModule } from './modules/network/network.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OccurrencesModule } from './modules/occurrences/occurrences.module';
import { PeopleModule } from './modules/people/people.module';
import { ProviderCompaniesModule } from './modules/provider-companies/provider-companies.module';
import { ReportsModule } from './modules/reports/reports.module';
import { TimelineModule } from './modules/timeline/timeline.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    ClientOnboardingModule,
    CalendarModule,
    DashboardModule,
    ProviderCompaniesModule,
    ClientCompaniesModule,
    ContractsModule,
    EntityTagsModule,
    AttachmentsModule,
    OccurrencesModule,
    NotificationsModule,
    NetworkModule,
    PeopleModule,
    EmploymentLinksModule,
    ReportsModule,
    TimelineModule,
    FocusBoardModule
  ]
})
export class AppModule {}
