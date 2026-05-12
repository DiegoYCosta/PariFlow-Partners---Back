import { ApiProperty } from '@nestjs/swagger';
import { ClientOnboardingVerificationChannel } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class StartClientOnboardingVerificationDto {
  @ApiProperty({ example: '11222333000181' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\D/g, '') : value
  )
  @IsString()
  @Matches(/^\d{14}$/)
  cnpj!: string;

  @ApiProperty({ enum: [ClientOnboardingVerificationChannel.EMAIL, ClientOnboardingVerificationChannel.PHONE] })
  @IsEnum(ClientOnboardingVerificationChannel)
  channel!: ClientOnboardingVerificationChannel;

  @ApiProperty({ example: 'ana.comercial@pariflow.local' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  target!: string;
}
