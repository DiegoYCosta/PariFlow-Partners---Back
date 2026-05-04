import { PartialType } from '@nestjs/swagger';
import { CreateContractPositionDto } from './create-contract-position.dto';

export class UpdateContractPositionDto extends PartialType(
  CreateContractPositionDto
) {}
