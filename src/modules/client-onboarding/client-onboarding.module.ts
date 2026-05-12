import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/database/prisma.module';
import { ClientOnboardingController } from './client-onboarding.controller';
import { ClientOnboardingService } from './client-onboarding.service';
import { PublicOnboardingRateLimitGuard } from './public-onboarding-rate-limit.guard';

@Module({
  imports: [PrismaModule],
  controllers: [ClientOnboardingController],
  providers: [ClientOnboardingService, PublicOnboardingRateLimitGuard]
})
export class ClientOnboardingModule {}
