import { ApiPropertyOptional } from '@nestjs/swagger';
import { CalendarEntryKind, CalendarEntryStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListCalendarEntriesQueryDto {
  @ApiPropertyOptional({ example: 'pes_01hxyzabc123def456ghi789' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  personPublicId?: string;

  @ApiPropertyOptional({ example: 'ctr_01hxyzabc123def456ghi789' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  contractPublicId?: string;

  @ApiPropertyOptional({ enum: CalendarEntryKind })
  @IsOptional()
  @IsEnum(CalendarEntryKind)
  kind?: CalendarEntryKind;

  @ApiPropertyOptional({ enum: CalendarEntryStatus })
  @IsOptional()
  @IsEnum(CalendarEntryStatus)
  status?: CalendarEntryStatus;

  @ApiPropertyOptional({
    example: '2026-05-01',
    description: 'Data inicial do recorte. Aceita ISO, YYYY-MM-DD ou DD/MM/AAAA.'
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  startsAtFrom?: string;

  @ApiPropertyOptional({
    example: '2026-05-31',
    description: 'Data final do recorte. Aceita ISO, YYYY-MM-DD ou DD/MM/AAAA.'
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  startsAtTo?: string;
}
