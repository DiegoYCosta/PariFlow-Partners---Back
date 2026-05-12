import { ApiPropertyOptional } from '@nestjs/swagger';
import { SensitiveSessionLevel } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class StartSensitiveSessionDto {
  @ApiPropertyOptional({
    enum: SensitiveSessionLevel,
    default: SensitiveSessionLevel.SENSITIVE
  })
  @IsOptional()
  @IsEnum(SensitiveSessionLevel)
  level?: SensitiveSessionLevel;

  @ApiPropertyOptional({
    example: 'Visualizacao de anexo sensivel do dossie.'
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  justification?: string;
}
