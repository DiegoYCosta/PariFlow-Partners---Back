import { ApiPropertyOptional } from '@nestjs/swagger';
import { OccurrenceNature, OccurrenceVisibility } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { timelineLinkEntityTypes } from './timeline-record-link.dto';

export class ListTimelineRecordsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-05' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  referenceMonth?: string;

  @ApiPropertyOptional({ example: 'RH' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional({ enum: OccurrenceNature })
  @IsOptional()
  @IsEnum(OccurrenceNature)
  nature?: OccurrenceNature;

  @ApiPropertyOptional({ enum: OccurrenceVisibility })
  @IsOptional()
  @IsEnum(OccurrenceVisibility)
  visibility?: OccurrenceVisibility;

  @ApiPropertyOptional({ enum: timelineLinkEntityTypes })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value
  )
  @IsIn(timelineLinkEntityTypes)
  entityType?: string;

  @ApiPropertyOptional({ example: 'epr_01hxyzabc123def456ghi789' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  entityPublicId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  monthOnly?: boolean;

  @ApiPropertyOptional({
    example: 'ACTIVE',
    description: 'Quando omitido, registros REMOVED ficam ocultos.'
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  status?: string;
}
