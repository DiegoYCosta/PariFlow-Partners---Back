import { PartialType } from '@nestjs/swagger';
import { CreateTimelineRecordDto } from './create-timeline-record.dto';

export class UpdateTimelineRecordDto extends PartialType(CreateTimelineRecordDto) {}
