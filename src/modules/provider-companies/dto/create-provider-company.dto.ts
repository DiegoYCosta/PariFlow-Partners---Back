import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProviderCompanyDto {
  @ApiProperty({
    example: 'PariFlow Servicos Ltda'
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
    example: '12345678000199'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  document!: string;

  @ApiProperty({
    example: 'ACTIVE'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  status!: string;

  @ApiPropertyOptional({
    example: {
      phone: '(11) 99999-9999',
      email: 'contato@empresa.com'
    }
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
