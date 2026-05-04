import { PartialType } from '@nestjs/swagger';
import { CreateOccurrenceDto } from './create-occurrence.dto';

export class UpdateOccurrenceDto extends PartialType(CreateOccurrenceDto) {}
