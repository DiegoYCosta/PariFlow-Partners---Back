import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

export const NETWORK_TIMELINE_PERIOD_PRESETS = [
  '6m',
  '1y',
  '2y',
  '5y',
  'all'
] as const;

export const NETWORK_TIMELINE_FOCUS_COMPANY_TYPES = [
  'provider_company',
  'client_company'
] as const;

export type NetworkTimelinePeriodPreset =
  (typeof NETWORK_TIMELINE_PERIOD_PRESETS)[number];

export type NetworkTimelineFocusCompanyType =
  (typeof NETWORK_TIMELINE_FOCUS_COMPANY_TYPES)[number];

function splitQueryList(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string') {
    const items = value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    return items.length > 0 ? items : undefined;
  }

  return undefined;
}

function queryBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  return undefined;
}

export class NetworkTimelineQueryDto {
  @ApiPropertyOptional({
    enum: NETWORK_TIMELINE_PERIOD_PRESETS,
    default: '1y'
  })
  @IsOptional()
  @IsIn(NETWORK_TIMELINE_PERIOD_PRESETS)
  periodPreset: NetworkTimelinePeriodPreset = '1y';

  @ApiPropertyOptional({
    format: 'date',
    example: '2026-01-01'
  })
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional({
    format: 'date',
    example: '2026-12-31'
  })
  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;

  @ApiPropertyOptional({
    example: 'epr_seed_base'
  })
  @IsOptional()
  @IsString()
  @MaxLength(26)
  focusCompanyPublicId?: string;

  @ApiPropertyOptional({
    enum: NETWORK_TIMELINE_FOCUS_COMPANY_TYPES
  })
  @IsOptional()
  @IsIn(NETWORK_TIMELINE_FOCUS_COMPANY_TYPES)
  focusCompanyType?: NetworkTimelineFocusCompanyType;

  @ApiPropertyOptional({
    type: [String],
    description: 'publicIds de empresas prestadoras usadas como recorte raiz.'
  })
  @Transform(({ value }) => splitQueryList(value))
  @IsOptional()
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(26, { each: true })
  rootCompanyPublicIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'publicIds de clientes contratantes usados como recorte.'
  })
  @Transform(({ value }) => splitQueryList(value))
  @IsOptional()
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(26, { each: true })
  clientCompanyPublicIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: 'active,expired'
  })
  @Transform(({ value }) => splitQueryList(value))
  @IsOptional()
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  contractStatuses?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: 'active,dismissed'
  })
  @Transform(({ value }) => splitQueryList(value))
  @IsOptional()
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  employeeStatuses?: string[];

  @ApiPropertyOptional({
    default: true
  })
  @Transform(({ value }) => queryBoolean(value))
  @IsOptional()
  @IsBoolean()
  includeHistorical = true;

  @ApiPropertyOptional({
    default: true
  })
  @Transform(({ value }) => queryBoolean(value))
  @IsOptional()
  @IsBoolean()
  includeMoves = true;

  @ApiPropertyOptional({
    default: true
  })
  @Transform(({ value }) => queryBoolean(value))
  @IsOptional()
  @IsBoolean()
  includeOperationalEvents = true;

  @ApiPropertyOptional({
    example: 'Maria'
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
