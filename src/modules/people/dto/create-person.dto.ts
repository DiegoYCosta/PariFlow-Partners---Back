import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';
import { CreateExternalWorkDto } from './create-external-work.dto';

export class CreatePersonDto {
  @ApiProperty({
    example: 'Joao da Silva',
    description: 'Registro-base da pessoa, separado do contexto de empresa, contrato e vinculo.'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({
    example: '12345678901'
  })
  @IsOptional()
  @IsString()
  @MaxLength(14)
  cpf?: string;

  @ApiPropertyOptional({
    example: '123456789'
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  rg?: string;

  @ApiPropertyOptional({
    example: 'joao@empresa.com'
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  email?: string;

  @ApiPropertyOptional({
    example: '(11) 99999-9999'
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({
    example: '1992-06-15T00:00:00.000Z',
    description: 'Data em ISO 8601 para a API manter um unico formato entre cadastro, detalhe e historico.'
  })
  @IsOptional()
  @IsString()
  @IsISO8601()
  birthDate?: string;

  @ApiPropertyOptional({
    example: {
      city: 'Sao Paulo',
      state: 'SP'
    },
    description:
      'Bloco flexivel de endereco. Se a tela passar a filtrar por chave fixa, vale modelar isso de forma estruturada.'
  })
  @IsOptional()
  @IsObject()
  addressJson?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: 'Candidato com experiencia previa em condominios.'
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    type: [CreateExternalWorkDto],
    description:
      'Historico externo opcional, mantido separado do vinculo formal para o front nao misturar trajetorias.'
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateExternalWorkDto)
  externalWorks?: CreateExternalWorkDto[];
}
