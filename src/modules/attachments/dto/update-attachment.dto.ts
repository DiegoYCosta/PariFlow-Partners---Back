import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  AttachmentClassification,
  SensitiveAudienceGroup
} from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

export class UpdateAttachmentDto {
  @ApiPropertyOptional({
    example: 'usr_01hxyzabc123def456ghi789'
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  ownerUserPublicId?: string;

  @ApiPropertyOptional({
    example: 'dossie-rh'
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @MaxLength(60)
  displayScope?: string;

  @ApiPropertyOptional({
    enum: AttachmentClassification
  })
  @IsOptional()
  @IsEnum(AttachmentClassification)
  classification?: AttachmentClassification;

  @ApiPropertyOptional({
    example: 'advertencia-assinada-v2.pdf'
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @MaxLength(180)
  fileName?: string;

  @ApiPropertyOptional({
    example: 'application/pdf'
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @ApiPropertyOptional({
    example: 'private/occurrences/ocr_01/advertencia-assinada-v2.pdf'
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @MaxLength(255)
  storagePath?: string;

  @ApiPropertyOptional({
    example: 'https://bucket.example.local/advertencia-assinada-v2.pdf'
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @MaxLength(255)
  externalLink?: string;

  @ApiPropertyOptional({
    example: 'Arquivo fisico no armario 4, pasta 2'
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @MaxLength(255)
  physicalLocation?: string;

  @ApiPropertyOptional({
    default: false
  })
  @IsOptional()
  @IsBoolean()
  visibleInExecutive?: boolean;

  @ApiPropertyOptional({
    default: true
  })
  @IsOptional()
  @IsBoolean()
  visibleInContext?: boolean;

  @ApiPropertyOptional({
    default: false
  })
  @IsOptional()
  @IsBoolean()
  requiresConfirmation?: boolean;

  @ApiPropertyOptional({
    enum: SensitiveAudienceGroup,
    isArray: true
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(SensitiveAudienceGroup, { each: true })
  allowedGroupKeys?: SensitiveAudienceGroup[];

  @ApiPropertyOptional({
    type: [String]
  })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
          .map((item) => (typeof item === 'string' ? item.trim() : item))
          .filter((item) => typeof item === 'string' && item.length > 0)
      : value
  )
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(26, { each: true })
  allowedUserPublicIds?: string[];
}