import { PartialType } from '@nestjs/swagger';
import { CreateProviderCompanyDto } from './create-provider-company.dto';

export class UpdateProviderCompanyDto extends PartialType(
  CreateProviderCompanyDto
) {}
