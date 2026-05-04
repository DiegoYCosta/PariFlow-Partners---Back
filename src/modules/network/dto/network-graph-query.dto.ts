import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

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

export class NetworkGraphQueryDto {
  @ApiPropertyOptional({
    enum: ['6m', '1y', '2y', 'all'],
    default: '1y'
  })
  @IsOptional()
  @IsIn(['6m', '1y', '2y', 'all'])
  periodPreset = '1y';

  @ApiPropertyOptional({
    example: 'Maria'
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'publicIds de empresas prestadoras usadas como lane raiz.'
  })
  @Transform(({ value }) => splitQueryList(value))
  @IsOptional()
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(26, { each: true })
  rootCompanyPublicIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'publicIds de clientes contratantes.'
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
    default: false
  })
  @Transform(({ value }) => queryBoolean(value))
  @IsOptional()
  @IsBoolean()
  includeIndirect = false;

  @ApiPropertyOptional({
    example: 'pes_01hxyzabc123def456ghi789'
  })
  @IsOptional()
  @IsString()
  @MaxLength(26)
  focusPublicId?: string;
}
