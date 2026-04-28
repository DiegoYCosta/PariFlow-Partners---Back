import { Module } from '@nestjs/common';
import { ClientCompaniesController } from './client-companies.controller';
import { ClientCompaniesService } from './client-companies.service';

@Module({
  controllers: [ClientCompaniesController],
  providers: [ClientCompaniesService]
})
export class ClientCompaniesModule {}
