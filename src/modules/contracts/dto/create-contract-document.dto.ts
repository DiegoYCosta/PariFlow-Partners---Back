import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttachmentClassification } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateContractDocumentDto {
  @ApiProperty({
    example: 'Contrato assinado'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title!: string;

  @ApiPropertyOptional({
    enum: AttachmentClassification,
    default: AttachmentClassification.FORMAL_DOCUMENT
  })
  @IsOptional()
  @IsEnum(AttachmentClassification)
  classification?: AttachmentClassification;

  @ApiPropertyOptional({
    example: 'contrato-assinado.pdf'
  })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  fileName?: string;

  @ApiPropertyOptional({
    example: 'application/pdf'
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @ApiPropertyOptional({
    example: 'https://drive.example.com/contrato-assinado'
  })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(255)
  externalLink?: string;

  @ApiPropertyOptional({
    example: 'Arquivo fisico - pasta contratos 2026'
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  physicalLocation?: string;

  @ApiPropertyOptional({
    example: 'Documento recebido por link externo.'
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
