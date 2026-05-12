import { PartialType } from '@nestjs/swagger';
import { CreateCalendarEntryDto } from './create-calendar-entry.dto';

export class UpdateCalendarEntryDto extends PartialType(CreateCalendarEntryDto) {}
