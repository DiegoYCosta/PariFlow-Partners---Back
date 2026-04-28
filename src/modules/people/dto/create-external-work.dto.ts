import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

export class CreateExternalWorkDto {
  @ApiProperty({
    example: 'Mercado Alpha'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  companyName!: string;

  @ApiPropertyOptional({
    example: 'Caixa'
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  roleName?: string;

  @ApiPropertyOptional({
    example: 'Escala 6x1'
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  schedule?: string;

  @ApiPropertyOptional({
    example: '2025-02-01T00:00:00.000Z'
  })
  @IsOptional()
  @IsString()
  @IsISO8601()
  startsAt?: string;

  @ApiPropertyOptional({
    example: '2025-12-15T00:00:00.000Z'
  })
  @IsOptional()
  @IsString()
  @IsISO8601()
  endsAt?: string;

  @ApiPropertyOptional({
    example: 'ACTIVE'
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;

  @ApiPropertyOptional({
    example: 'Atividade externa informada pelo candidato.'
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
