import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttachmentClassification } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

export class ListAttachmentsQueryDto {
  @ApiPropertyOptional({
    example: 'ocr_01hxyzabc123def456ghi789'
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  occurrencePublicId?: string;

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
    enum: AttachmentClassification,
    required: false
  })
  @IsOptional()
  @IsEnum(AttachmentClassification)
  classification?: AttachmentClassification;
}
