import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CalendarEntryPriority,
  CalendarNotificationPolicy
} from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength
} from 'class-validator';

export class CreateFocusBoardReminderDto {
  @ApiProperty({ example: 'Revisar documentos' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title!: string;

  @ApiPropertyOptional({ example: 'Lembrete criado a partir do Focus Board.' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ example: '2026-07-15T09:00:00-03:00' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  startsAt!: string;

  @ApiPropertyOptional({ example: '2026-07-15T10:00:00-03:00' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(40)
  endsAt?: string;

  @ApiPropertyOptional({ default: 'America/Sao_Paulo' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(64)
  timezone = 'America/Sao_Paulo';

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isAllDay = false;

  @ApiPropertyOptional({ enum: CalendarEntryPriority })
  @IsOptional()
  @IsEnum(CalendarEntryPriority)
  priority: CalendarEntryPriority = CalendarEntryPriority.NORMAL;

  @ApiPropertyOptional({ enum: CalendarNotificationPolicy })
  @IsOptional()
  @IsEnum(CalendarNotificationPolicy)
  notificationPolicy: CalendarNotificationPolicy =
    CalendarNotificationPolicy.ONE_BUSINESS_DAY_BEFORE;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  notificationTime = '09:00';
}
