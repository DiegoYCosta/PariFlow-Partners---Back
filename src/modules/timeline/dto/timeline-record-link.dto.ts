import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf
} from 'class-validator';

export const timelineLinkEntityTypes = [
  'PROVIDER_COMPANY',
  'CLIENT_COMPANY',
  'CONTRACT',
  'CONTRACT_TEXT',
  'PERSON',
  'EMPLOYMENT_LINK',
  'POSITION',
  'GROUP',
  'CITY',
  'OTHER'
] as const;

export type TimelineLinkEntityType = (typeof timelineLinkEntityTypes)[number];

export class TimelineRecordLinkDto {
  @ApiPropertyOptional({
    enum: timelineLinkEntityTypes,
    example: 'PROVIDER_COMPANY'
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value
  )
  @IsIn(timelineLinkEntityTypes)
  entityType!: TimelineLinkEntityType;

  @ApiPropertyOptional({
    example: 'epr_01hxyzabc123def456ghi789'
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  entityPublicId?: string;

  @ApiPropertyOptional({
    example: 'Contrato de limpeza Campinas'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  labelSnapshot?: string;

  @ApiPropertyOptional({
    example: 'Referencia informada manualmente pelo usuario.'
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  notes?: string;
}
