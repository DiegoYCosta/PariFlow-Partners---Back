import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';
import { GLOBAL_SEARCH_TYPES, GlobalSearchType } from '../global-search.constants';

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

export class GlobalSearchQueryDto {
  @ApiProperty({
    example: 'joao',
    minLength: 2,
    maxLength: 80
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  q!: string;

  @ApiPropertyOptional({
    type: [String],
    enum: GLOBAL_SEARCH_TYPES,
    example: 'people,contracts'
  })
  @Transform(({ value }) => splitQueryList(value))
  @IsOptional()
  @ArrayUnique()
  @IsString({ each: true })
  @IsIn(GLOBAL_SEARCH_TYPES, { each: true })
  types?: GlobalSearchType[];

  @ApiPropertyOptional({
    default: 5,
    minimum: 1,
    maximum: 10
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit = 5;

  @ApiPropertyOptional({
    default: false
  })
  @Transform(({ value }) => queryBoolean(value))
  @IsOptional()
  @IsBoolean()
  includeInactive = false;
}
