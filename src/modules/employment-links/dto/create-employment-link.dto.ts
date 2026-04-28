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
    example: 'pes_01hxyz...'
  })
  @IsString()
  @IsNotEmpty()
  personPublicId!: string;

  @ApiProperty({
    example: 'epr_01hxyz...'
  })
  @IsString()
  @IsNotEmpty()
  providerCompanyPublicId!: string;

  @ApiProperty({
    example: 'ctr_01hxyz...'
  })
  @IsString()
  @IsNotEmpty()
  contractPublicId!: string;

  @ApiProperty({
    example: 'pos_01hxyz...'
  })
  @IsString()
  @IsNotEmpty()
  positionPublicId!: string;

  @ApiProperty({
    example: 'CLT'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  type!: string;

  @ApiPropertyOptional({
    enum: EmploymentLinkStatus,
    example: EmploymentLinkStatus.PENDING,
    default: EmploymentLinkStatus.PENDING
  })
  @IsOptional()
  @IsEnum(EmploymentLinkStatus)
  status?: EmploymentLinkStatus;

  @ApiProperty({
    example: '2026-02-01T00:00:00.000Z'
  })
  @IsString()
  @IsISO8601()
  startsAt!: string;

  @ApiPropertyOptional({
    example: '2026-12-31T00:00:00.000Z'
  })
  @IsOptional()
  @IsString()
  @IsISO8601()
  endsAt?: string;
}
