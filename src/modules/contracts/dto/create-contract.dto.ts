import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateContractDto {
  @ApiProperty({
    example: 'epr_01hxyz...'
  })
  @IsString()
  @IsNotEmpty()
  providerCompanyPublicId!: string;

  @ApiProperty({
    example: 'cli_01hxyz...'
  })
  @IsString()
  @IsNotEmpty()
  clientCompanyPublicId!: string;

  @ApiProperty({
    example: '2026-04-27T00:00:00.000Z'
  })
  @IsString()
  @IsISO8601()
  startsAt!: string;

  @ApiPropertyOptional({
    example: '2027-04-27T00:00:00.000Z'
  })
  @IsOptional()
  @IsString()
  @IsISO8601()
  endsAt?: string;

  @ApiProperty({
    example: 'ACTIVE'
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
