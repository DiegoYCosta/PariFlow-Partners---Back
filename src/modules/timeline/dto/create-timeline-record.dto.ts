import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OccurrenceNature, OccurrenceVisibility } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested
} from 'class-validator';
import { TimelineRecordLinkDto } from './timeline-record-link.dto';

export class CreateTimelineRecordDto {
  @ApiProperty({ example: 'Inicio de contrato de limpeza' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title!: string;

  @ApiProperty({
    example: 'Empresa X iniciou contrato de limpeza na unidade Campinas.'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({
    example: 'CONTRATO'
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  category = 'OPERACIONAL';

  @ApiPropertyOptional({
    enum: OccurrenceNature,
    default: OccurrenceNature.NEUTRAL
  })
  @IsOptional()
  @IsEnum(OccurrenceNature)
  nature: OccurrenceNature = OccurrenceNature.NEUTRAL;

  @ApiProperty({
    example: '2026-05',
    description: 'Mes de referencia no formato YYYY-MM.'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  referenceMonth!: string;

  @ApiPropertyOptional({
    example: '2026-05-12'
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  eventDate?: string;

  @ApiPropertyOptional({
    enum: OccurrenceVisibility,
    default: OccurrenceVisibility.INTERNAL
  })
  @IsOptional()
  @IsEnum(OccurrenceVisibility)
  visibility: OccurrenceVisibility = OccurrenceVisibility.INTERNAL;

  @ApiPropertyOptional({
    example: 'ACTIVE',
    default: 'ACTIVE'
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  status?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Sinaliza registros mensais sem dia especifico.'
  })
  @IsOptional()
  @IsBoolean()
  isMonthOnly = false;

  @ApiPropertyOptional({
    type: TimelineRecordLinkDto,
    isArray: true
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(24)
  @ValidateNested({ each: true })
  @Type(() => TimelineRecordLinkDto)
  links?: TimelineRecordLinkDto[];
}
