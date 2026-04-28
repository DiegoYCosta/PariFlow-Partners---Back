import { Module } from '@nestjs/common';
import { ProviderCompaniesController } from './provider-companies.controller';
import { ProviderCompaniesService } from './provider-companies.service';

@Module({
  controllers: [ProviderCompaniesController],
  providers: [ProviderCompaniesService]
})
export class ProviderCompaniesModule {}
