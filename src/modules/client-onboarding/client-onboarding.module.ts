import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/database/prisma.module';
import { ClientOnboardingController } from './client-onboarding.controller';
import { ClientOnboardingService } from './client-onboarding.service';

@Module({
  imports: [PrismaModule],
  controllers: [ClientOnboardingController],
  providers: [ClientOnboardingService]
})
export class ClientOnboardingModule {}
