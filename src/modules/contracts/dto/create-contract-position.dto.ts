import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateContractPositionDto {
  @ApiProperty({
    example: 'srv_01hxyz...',
    description: 'publicId do servico ativo usado por este posto.'
  })
  @IsString()
  @IsNotEmpty()
  servicePublicId!: string;

  @ApiProperty({
    example: 'Porteiro Diurno',
    description: 'Nome do posto ou vaga dentro do contrato selecionado.'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({
    example: 'Torre A'
  })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  location?: string;

  @ApiPropertyOptional({
    example: 'Diurno'
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  shift?: string;

  @ApiPropertyOptional({
    example: '12x36'
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  schedule?: string;

  @ApiPropertyOptional({
    example: 'Reciclagem de portaria e controle de acesso.'
  })
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiPropertyOptional({
    example: 'ACTIVE',
    default: 'ACTIVE'
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;
}
