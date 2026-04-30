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
    example: 'Mercado Alpha',
    description: 'Empresa do historico externo, sem confundir com prestadora do modulo operacional.'
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
    example: '2025-02-01T00:00:00.000Z',
    description: 'Data em ISO 8601 para manter ordenacao e leitura cronologica consistentes.'
  })
  @IsOptional()
  @IsString()
  @IsISO8601()
  startsAt?: string;

  @ApiPropertyOptional({
    example: '2025-12-15T00:00:00.000Z',
    description: 'Mesma regra da data inicial para o front nao lidar com formatos mistos.'
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
