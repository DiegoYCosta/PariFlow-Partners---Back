import { PartialType } from '@nestjs/swagger';
import { CreateContractTypeDto } from './create-contract-type.dto';

export class UpdateContractTypeDto extends PartialType(CreateContractTypeDto) {}
