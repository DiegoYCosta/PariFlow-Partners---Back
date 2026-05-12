import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClientOnboardingVerificationChannel } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';
import {
  accessLevelQuotaKeys,
  companySizePresetValues,
  companyTypePresetValues
} from '../client-onboarding.constants';

export class ClientOnboardingAccessQuotasDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  ADMIN?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  EXECUTIVE?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  LEGAL?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  HR?: number;

  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  OPERATIONS?: number;
}

export class CreateClientOnboardingDto {
  @ApiProperty({ example: 'PariFlow Operacoes' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  tradeName!: string;

  @ApiProperty({ example: 'PariFlow Operacoes Ltda' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  legalName!: string;

  @ApiProperty({ example: '11222333000181' })
  @Transform(digitsOnly)
  @IsString()
  @Matches(/^\d{14}$/)
  cnpj!: string;

  @ApiPropertyOptional({ example: '123456789' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(40)
  stateRegistration?: string;

  @ApiPropertyOptional({ example: '987654321' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(40)
  municipalRegistration?: string;

  @ApiProperty({ enum: companyTypePresetValues })
  @Transform(trimString)
  @IsString()
  @IsIn(companyTypePresetValues)
  companyType!: string;

  @ApiProperty({ example: 'Gestao condominial e operacao terceirizada' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  segment!: string;

  @ApiPropertyOptional({ example: '8112500' })
  @IsOptional()
  @Transform(digitsOnly)
  @IsString()
  @MaxLength(16)
  primaryCnae?: string;

  @ApiProperty({ enum: companySizePresetValues })
  @Transform(trimString)
  @IsString()
  @IsIn(companySizePresetValues)
  companySize!: string;

  @ApiProperty({ example: 'Maria Oliveira' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  primaryContactName!: string;

  @ApiPropertyOptional({ example: 'ana.comercial@pariflow.local' })
  @IsOptional()
  @Transform(lowercaseTrimString)
  @IsEmail()
  @MaxLength(180)
  primaryContactEmail?: string;

  @ApiPropertyOptional({ example: '+5511990011001' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(30)
  primaryContactPhone?: string;

  @ApiPropertyOptional({
    type: ClientOnboardingAccessQuotasDto,
    description: `Chaves aceitas: ${accessLevelQuotaKeys.join(', ')}.`
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ClientOnboardingAccessQuotasDto)
  accessLevelQuotas?: ClientOnboardingAccessQuotasDto;

  @ApiPropertyOptional({
    default: true,
    description:
      'Quando false, a solicitacao segue para analise manual do responsavel comercial.'
  })
  @IsOptional()
  @IsBoolean()
  verificationAccepted = false;

  @ApiPropertyOptional({
    enum: ClientOnboardingVerificationChannel,
    default: ClientOnboardingVerificationChannel.NONE
  })
  @IsOptional()
  @IsEnum(ClientOnboardingVerificationChannel)
  verificationChannel: ClientOnboardingVerificationChannel =
    ClientOnboardingVerificationChannel.NONE;

  @ApiPropertyOptional({ example: 'ver_01hxyzabc123def456ghi789' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(26)
  verificationChallengePublicId?: string;

  @ApiPropertyOptional({ example: '123456' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^\d{6}$/)
  verificationCode?: string;
}

function trimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

function lowercaseTrimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function digitsOnly({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.replace(/\D/g, '') : value;
}
