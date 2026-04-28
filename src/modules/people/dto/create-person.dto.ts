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
    example: 'Joao da Silva'
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
    example: '1992-06-15T00:00:00.000Z'
  })
  @IsOptional()
  @IsString()
  @IsISO8601()
  birthDate?: string;

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
    example: 'Candidato com experiencia previa em condominios.'
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    type: [CreateExternalWorkDto]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateExternalWorkDto)
  externalWorks?: CreateExternalWorkDto[];
}
