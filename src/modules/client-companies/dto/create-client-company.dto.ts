import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateClientCompanyDto {
  @ApiProperty({
    example: 'Condominio Bela Vista'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional({
    example: '12345678000199'
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  document?: string;

  @ApiProperty({
    example: 'CONDOMINIO'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  clientType!: string;

  @ApiPropertyOptional({
    example: {
      city: 'Sao Paulo',
      state: 'SP'
    }
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
    example: 'ACTIVE'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  status!: string;
}
