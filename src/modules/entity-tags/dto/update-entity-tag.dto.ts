import { ApiPropertyOptional } from '@nestjs/swagger';
import { EntityTagClassification } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min
} from 'class-validator';

export class UpdateEntityTagDto {
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
