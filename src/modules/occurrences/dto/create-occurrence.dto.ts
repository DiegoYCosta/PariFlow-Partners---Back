import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OccurrenceNature, OccurrenceVisibility } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

export class CreateOccurrenceDto {
  @ApiProperty({
    example: 'pes_01hxyzabc123def456ghi789',
    description: 'publicId da pessoa que ancora a ocorrencia.'
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  personPublicId!: string;

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

  @ApiProperty({
    example: 'ADVERTENCIA',
    description: 'Tipo operacional da ocorrencia como valor de dominio.'
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  type!: string;

  @ApiProperty({
    example: 'people-dossie',
    description: 'Escopo de exibicao e agrupamento da ocorrencia.'
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  scope!: string;

  @ApiProperty({
    enum: OccurrenceNature,
    example: OccurrenceNature.NEGATIVE
  })
  @IsEnum(OccurrenceNature)
  nature!: OccurrenceNature;

  @ApiProperty({
    example: 'Atraso recorrente em posto critico'
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @ApiProperty({
    example: 'Registro operacional revisado pela supervisao.'
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({
    example: '2026-02-01T10:30:00.000Z'
  })
  @IsString()
  @IsISO8601()
  occurredAt!: string;

  @ApiProperty({
    example: 'MEDIUM'
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  severityLevel!: string;

  @ApiPropertyOptional({
    enum: OccurrenceVisibility,
    example: OccurrenceVisibility.INTERNAL,
    default: OccurrenceVisibility.INTERNAL
  })
  @IsOptional()
  @IsEnum(OccurrenceVisibility)
  visibility?: OccurrenceVisibility;

  @ApiPropertyOptional({
    default: false
  })
  @IsOptional()
  @IsBoolean()
  showInExecutivePanel = false;

  @ApiPropertyOptional({
    example: 'ACTIVE',
    default: 'ACTIVE'
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
