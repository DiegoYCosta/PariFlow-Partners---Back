import { ApiProperty } from '@nestjs/swagger';
import {
  EntityTagClassification,
  EntityTagTargetType
} from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

export class ListEntityTagsQueryDto {
  @ApiProperty({
    enum: EntityTagTargetType
  })
  @IsEnum(EntityTagTargetType)
  targetType!: EntityTagTargetType;

  @ApiProperty({
    example: 'epr_01hxyzabc123def456ghi789'
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  targetPublicId!: string;

  @ApiProperty({
    enum: EntityTagClassification,
    required: false
  })
  @IsOptional()
  @IsEnum(EntityTagClassification)
  classification?: EntityTagClassification;
}
