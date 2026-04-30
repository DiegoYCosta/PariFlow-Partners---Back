import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentLinkStatus } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

export class CreateEmploymentLinkDto {
  @ApiProperty({
    example: 'pes_01hxyz...',
    description: 'publicId da pessoa escolhida no cadastro base.'
  })
  @IsString()
  @IsNotEmpty()
  personPublicId!: string;

  @ApiProperty({
    example: 'epr_01hxyz...',
    description: 'publicId da prestadora no mesmo contrato de identificacao usado nas listas.'
  })
  @IsString()
  @IsNotEmpty()
  providerCompanyPublicId!: string;

  @ApiProperty({
    example: 'ctr_01hxyz...',
    description: 'publicId do contrato que ja precisa pertencer a prestadora escolhida.'
  })
  @IsString()
  @IsNotEmpty()
  contractPublicId!: string;

  @ApiProperty({
    example: 'pos_01hxyz...',
    description: 'publicId do posto relacionado ao contrato informado.'
  })
  @IsString()
  @IsNotEmpty()
  positionPublicId!: string;

  @ApiProperty({
    example: 'CLT',
    description: 'Tipo do vinculo como valor de dominio, nao label montada pela tela.'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  type!: string;

  @ApiPropertyOptional({
    enum: EmploymentLinkStatus,
    example: EmploymentLinkStatus.PENDING,
    default: EmploymentLinkStatus.PENDING,
    description: 'Se nao vier, o backend assume o status inicial previsto para o fluxo.'
  })
  @IsOptional()
  @IsEnum(EmploymentLinkStatus)
  status?: EmploymentLinkStatus;

  @ApiProperty({
    example: '2026-02-01T00:00:00.000Z',
    description: 'Data em ISO 8601 para sustentar cronologia, filtro e auditoria sem ambiguidade.'
  })
  @IsString()
  @IsISO8601()
  startsAt!: string;

  @ApiPropertyOptional({
    example: '2026-12-31T00:00:00.000Z',
    description: 'Data final opcional no mesmo padrao da data inicial.'
  })
  @IsOptional()
  @IsString()
  @IsISO8601()
  endsAt?: string;
}
