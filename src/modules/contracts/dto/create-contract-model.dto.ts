import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContractCatalogStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateContractModelDto {
  @ApiProperty({
    example: 'tco_01hxyzabc123def456ghi789'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  contractTypePublicId!: string;

  @ApiProperty({
    example: 'Portaria 12x36'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  name!: string;

  @ApiPropertyOptional({
    example:
      'Modelo reutilizavel para contratos de portaria em escala 12x36.'
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: '12x36'
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  defaultSchedule?: string;

  @ApiPropertyOptional({
    enum: ContractCatalogStatus,
    default: ContractCatalogStatus.ACTIVE
  })
  @IsOptional()
  @IsEnum(ContractCatalogStatus)
  status?: ContractCatalogStatus;
}
