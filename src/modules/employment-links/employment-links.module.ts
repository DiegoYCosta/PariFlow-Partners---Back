import { Module } from '@nestjs/common';
import { EmploymentLinksController } from './employment-links.controller';
import { EmploymentLinksService } from './employment-links.service';

@Module({
  controllers: [EmploymentLinksController],
  providers: [EmploymentLinksService]
})
export class EmploymentLinksModule {}
