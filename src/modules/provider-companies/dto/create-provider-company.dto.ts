import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProviderCompanyDto {
  @ApiProperty({
    example: 'PariFlow Servicos Ltda',
    description: 'Razao social como deve sair tambem nas listagens e detalhes.'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  legalName!: string;

  @ApiPropertyOptional({
    example: 'PariFlow'
  })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  tradeName?: string;

  @ApiProperty({
    example: '12345678000199',
    description:
      'Documento usado para busca e conciliacao. O ideal e manter o mesmo formato de entrada e saida.'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  document!: string;

  @ApiProperty({
    example: 'ACTIVE',
    description:
      'Status de dominio. O front pode traduzir label, mas nao deve inventar valor diferente do enviado pela API.'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  status!: string;

  @ApiPropertyOptional({
    example: {
      phone: '(11) 99999-9999',
      email: 'contato@empresa.com'
    },
    description:
      'Campo flexivel para a fase inicial. Se alguma chave virar regra de tela, vale promover para campo proprio.'
  })
  @IsOptional()
  @IsObject()
  contactsJson?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: 'Empresa principal do grupo.'
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
