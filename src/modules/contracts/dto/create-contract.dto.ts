import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateContractDto {
  @ApiProperty({
    example: 'epr_01hxyz...',
    description: 'publicId da prestadora escolhido a partir da listagem anterior, nunca id interno.'
  })
  @IsString()
  @IsNotEmpty()
  providerCompanyPublicId!: string;

  @ApiProperty({
    example: 'cli_01hxyz...',
    description: 'publicId do cliente contratante usado pelo front para conciliacao entre modulos.'
  })
  @IsString()
  @IsNotEmpty()
  clientCompanyPublicId!: string;

  @ApiProperty({
    example: '2026-04-27T00:00:00.000Z',
    description: 'Data em ISO 8601. Fuso e exibicao local ficam na camada de interface.'
  })
  @IsString()
  @IsISO8601()
  startsAt!: string;

  @ApiPropertyOptional({
    example: '2027-04-27T00:00:00.000Z',
    description: 'Data final opcional no mesmo padrao da inicial para nao haver conversao assimetrica.'
  })
  @IsOptional()
  @IsString()
  @IsISO8601()
  endsAt?: string;

  @ApiProperty({
    example: 'ACTIVE',
    description: 'Status do contrato em vocabulario de dominio, sem depender de label de tela.'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  status!: string;

  @ApiPropertyOptional({
    example: 'Contrato principal do cliente.'
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
