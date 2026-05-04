import { PartialType } from '@nestjs/swagger';
import { CreateContractModelDto } from './create-contract-model.dto';

export class UpdateContractModelDto extends PartialType(CreateContractModelDto) {}
