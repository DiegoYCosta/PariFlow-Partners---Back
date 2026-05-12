import { ApiPropertyOptional } from '@nestjs/swagger';
import { CalendarEntryKind, CalendarEntryStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

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

  @ApiPropertyOptional({ example: 'epr_01hxyzabc123def456ghi789' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  providerCompanyPublicId?: string;

  @ApiPropertyOptional({ example: 'cli_01hxyzabc123def456ghi789' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  clientCompanyPublicId?: string;

  @ApiPropertyOptional({ example: 'vin_01hxyzabc123def456ghi789' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  employmentLinkPublicId?: string;

  @ApiPropertyOptional({ example: 'pos_01hxyzabc123def456ghi789' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  positionPublicId?: string;

  @ApiPropertyOptional({ example: 'tct_01hxyzabc123def456ghi789' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  contractTypePublicId?: string;

  @ApiPropertyOptional({ enum: CalendarEntryKind })
  @IsOptional()
  @IsEnum(CalendarEntryKind)
  kind?: CalendarEntryKind;

  @ApiPropertyOptional({ enum: CalendarEntryStatus })
  @IsOptional()
  @IsEnum(CalendarEntryStatus)
  status?: CalendarEntryStatus;

  @ApiPropertyOptional({ example: 'BIRTHDAY' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional({ example: 'YEARLY' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  recurrenceRule?: string;

  @ApiPropertyOptional({ example: 'BR-SP-CAMPINAS' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  holidayRegionCode?: string;

  @ApiPropertyOptional({ example: 'BR-SP-CAMPINAS' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  appliesToRegionCode?: string;

  @ApiPropertyOptional({ example: 'SP' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(2)
  appliesToStateCode?: string;

  @ApiPropertyOptional({ example: 'Campinas' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  appliesToCityName?: string;

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

  @ApiPropertyOptional({
    example: '2026-05-01',
    description:
      'Data inicial de cadastro do item. Diferente da data de vigencia/agenda.'
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  createdAtFrom?: string;

  @ApiPropertyOptional({
    example: '2026-05-31',
    description:
      'Data final de cadastro do item. Diferente da data de vigencia/agenda.'
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  createdAtTo?: string;

  @ApiPropertyOptional({
    default: false,
    description:
      'Por padrao lembretes vinculados a funcionarios desligados ficam ocultos.'
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeDismissed?: boolean;
}
