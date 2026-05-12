import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

export class CreateCalendarNonBusinessDayDto {
  @ApiProperty({
    example: '2026-05-20',
    description: 'Data do dia nao util. Aceita ISO, YYYY-MM-DD ou DD/MM/AAAA.'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  date!: string;

  @ApiProperty({ example: 'Feriado municipal em Campinas' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ example: 'MUNICIPAL_HOLIDAY', default: 'CUSTOM' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value
  )
  @IsString()
  @MaxLength(40)
  scope = 'CUSTOM';

  @ApiPropertyOptional({ example: 'BR-SP-CAMPINAS' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value
  )
  @IsString()
  @MaxLength(40)
  regionCode?: string;

  @ApiPropertyOptional({ example: 'SP' })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value
  )
  @IsString()
  @MaxLength(2)
  stateCode?: string;

  @ApiPropertyOptional({ example: 'Campinas' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  cityName?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Quando true, o mesmo dia/mes vale nos anos seguintes.'
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isRecurringYearly = false;

  @ApiPropertyOptional({
    example:
      'ATENCAO DEPARTAMENTO PESSOAL: pagar adicional de hora extra conforme regra local.'
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
