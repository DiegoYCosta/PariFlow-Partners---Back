import { ApiPropertyOptional } from '@nestjs/swagger';
import { OccurrenceNature, OccurrenceVisibility } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListOccurrencesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'pes_01hxyzabc123def456ghi789'
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  personPublicId?: string;

  @ApiPropertyOptional({
    example: 'epr_01hxyzabc123def456ghi789'
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  providerCompanyPublicId?: string;

  @ApiPropertyOptional({
    example: 'vin_01hxyzabc123def456ghi789'
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  employmentLinkPublicId?: string;

  @ApiPropertyOptional({
    example: 'pos_01hxyzabc123def456ghi789'
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  positionPublicId?: string;

  @ApiPropertyOptional({
    enum: OccurrenceNature
  })
  @IsOptional()
  @IsEnum(OccurrenceNature)
  nature?: OccurrenceNature;

  @ApiPropertyOptional({
    enum: OccurrenceVisibility
  })
  @IsOptional()
  @IsEnum(OccurrenceVisibility)
  visibility?: OccurrenceVisibility;

  @ApiPropertyOptional({
    example: 'ACTIVE',
    description:
      'Quando omitido, a lista oculta ocorrencias removidas logicamente.'
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  status?: string;
}
