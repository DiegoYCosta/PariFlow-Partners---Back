import { PartialType } from '@nestjs/swagger';
import { CreateContractDocumentDto } from './create-contract-document.dto';

export class UpdateContractDocumentDto extends PartialType(CreateContractDocumentDto) {}
