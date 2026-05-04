import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContractCatalogStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateContractTypeDto {
  @ApiProperty({
    example: 'Contratacao'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    example: 'Contratos de prestacao ou contratacao operacional.'
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: ContractCatalogStatus,
    default: ContractCatalogStatus.ACTIVE
  })
  @IsOptional()
  @IsEnum(ContractCatalogStatus)
  status?: ContractCatalogStatus;
}
