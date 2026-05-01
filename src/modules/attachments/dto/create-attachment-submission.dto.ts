import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateAttachmentSubmissionDto {
  @ApiProperty({
    example: 'ocr_01hxyzabc123def456ghi789',
    description:
      'publicId da ocorrencia que vai receber o anexo protegido.'
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  occurrencePublicId!: string;

  @ApiProperty({
    example: 'usr_01hxyzabc123def456ghi789',
    description:
      'publicId do colaborador que sera considerado dono do anexo para leitura, edicao e exclusao futuras.'
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  ownerUserPublicId!: string;

  @ApiProperty({
    example: 'dossie-rh',
    description:
      'Escopo visual resumido do anexo dentro da ocorrencia ou da ficha relacionada.'
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  displayScope!: string;

  @ApiProperty({
    enum: AttachmentClassification,
    description:
      'Distingue documento formal, anexo sensivel e referencia de apoio.'
  })
  @IsEnum(AttachmentClassification)
  classification!: AttachmentClassification;

  @ApiProperty({
    example: 'advertencia-assinada.pdf'
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  fileName!: string;

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
    example: 'private/occurrences/ocr_01/advertencia-assinada.pdf'
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @MaxLength(255)
  storagePath?: string;

  @ApiPropertyOptional({
    example: 'https://bucket.example.local/advertencia-assinada.pdf'
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
  visibleInExecutive = false;

  @ApiPropertyOptional({
    default: true
  })
  @IsOptional()
  @IsBoolean()
  visibleInContext = true;

  @ApiPropertyOptional({
    default: false
  })
  @IsOptional()
  @IsBoolean()
  requiresConfirmation = false;

  @ApiPropertyOptional({
    enum: SensitiveAudienceGroup,
    isArray: true,
    description:
      'Grupos de colaboradores autorizados a consultar o anexo alem da autoria.'
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(SensitiveAudienceGroup, { each: true })
  allowedGroupKeys?: SensitiveAudienceGroup[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'Lista opcional de colaboradores especificos autorizados a consultar o anexo.'
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