import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateClientCompanyDto {
  @ApiProperty({
    example: 'Condominio Bela Vista',
    description: 'Nome principal do cliente do jeito que vai aparecer para selecao e detalhe.'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional({
    example: '12345678000199',
    description:
      'Documento opcional, mas quando vier precisa seguir padrao estavel para busca e exibicao.'
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  document?: string;

  @ApiProperty({
    example: 'CONDOMINIO',
    description: 'Tipo de cliente como valor de dominio, nao como texto livre de interface.'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  clientType!: string;

  @ApiPropertyOptional({
    example: {
      city: 'Sao Paulo',
      state: 'SP'
    },
    description:
      'Endereco em bloco flexivel por enquanto. Se o front passar a depender de chave fixa, estruturar depois no contrato.'
  })
  @IsOptional()
  @IsObject()
  addressJson?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: 'Maria Oliveira'
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  contactName?: string;

  @ApiProperty({
    example: 'ACTIVE',
    description: 'Status de dominio que deve seguir igual nas listas, filtros e detalhe.'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  status!: string;
}
