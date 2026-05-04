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

  @ApiPropertyOptional({
    example: 'tco_01hxyz...',
    description:
      'Tipo de contrato. Se omitido, o backend usa o tipo base ativo para preservar compatibilidade.'
  })
  @IsOptional()
  @IsString()
  @MaxLength(26)
  contractTypePublicId?: string;

  @ApiPropertyOptional({
    example: 'mco_01hxyz...',
    description:
      'Modelo reutilizavel do contrato, como Limpeza 12x36 ou Portaria 12x36. Reutilizar o mesmo modelo nao cria relacao entre empresas.'
  })
  @IsOptional()
  @IsString()
  @MaxLength(26)
  contractModelPublicId?: string;

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
