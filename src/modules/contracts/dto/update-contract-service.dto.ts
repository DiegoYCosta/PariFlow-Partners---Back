import { PartialType } from '@nestjs/swagger';
import { CreateContractServiceDto } from './create-contract-service.dto';

export class UpdateContractServiceDto extends PartialType(
  CreateContractServiceDto
) {}
