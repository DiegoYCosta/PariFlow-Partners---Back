import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AccessProfileCode } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

export class RequestCompanyAccessDto {
  @ApiProperty({ example: "11222333000181" })
  @Transform(digitsOnly)
  @IsString()
  @Matches(/^\d{14}$/)
  cnpj!: string;

  @ApiProperty({ example: "PariFlow Operacoes Ltda" })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  companyName!: string;

  @ApiProperty({ example: "12345678901" })
  @Transform(digitsOnly)
  @IsString()
  @Matches(/^(\d{11}|\d{14})$/)
  requesterDocument!: string;

  @ApiProperty({ enum: AccessProfileCode })
  @IsEnum(AccessProfileCode)
  requestedAccessLevel!: AccessProfileCode;

  @ApiProperty({ example: "Maria Oliveira" })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  requesterName!: string;

  @ApiProperty({ example: "Responsavel operacional" })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  requesterRole!: string;

  @ApiPropertyOptional({ example: "maria@empresa.com" })
  @IsOptional()
  @Transform(lowercaseTrimString)
  @IsEmail()
  @MaxLength(180)
  requesterEmail?: string;

  @ApiPropertyOptional({ example: "+5511999999999" })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(30)
  requesterPhone?: string;

  @ApiPropertyOptional({
    example: "Solicito acesso como responsavel operacional.",
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  notes?: string;
}

function trimString({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
}

function lowercaseTrimString({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim().toLowerCase() : value;
}

function digitsOnly({ value }: { value: unknown }) {
  return typeof value === "string" ? value.replace(/\D/g, "") : value;
}
