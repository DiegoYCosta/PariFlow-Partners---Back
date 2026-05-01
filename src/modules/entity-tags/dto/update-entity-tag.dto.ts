import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  EntityTagClassification,
  SensitiveAudienceGroup
} from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min
} from 'class-validator';

export class UpdateEntityTagDto {
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
    example: 'filha com consulta nas segundas'
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @MaxLength(80)
  label?: string;

  @ApiPropertyOptional({
    example:
      'Evitar escala extra na segunda pela manha sem alinhamento previo. Conteudo continua sensivel e limitado a 350 caracteres.'
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @MaxLength(350)
  content?: string;

  @ApiPropertyOptional({
    enum: EntityTagClassification
  })
  @IsOptional()
  @IsEnum(EntityTagClassification)
  classification?: EntityTagClassification;

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

  @ApiPropertyOptional({
    example: '#536A75'
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value
  )
  @IsString()
  @Matches(/^#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/)
  @MaxLength(32)
  color?: string;

  @ApiPropertyOptional({
    example: 2
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;
}