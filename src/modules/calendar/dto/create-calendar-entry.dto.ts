import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AccessProfileCode,
  CalendarBusinessDayPolicy,
  CalendarEntryKind,
  CalendarEntryPriority,
  CalendarEntryStatus,
  CalendarNotificationPolicy
} from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min
} from 'class-validator';

export const calendarNotificationChannels = [
  'IN_APP',
  'EMAIL',
  'PUSH',
  'WEBHOOK'
] as const;

export type CalendarNotificationChannel =
  (typeof calendarNotificationChannels)[number];

export class CreateCalendarEntryDto {
  @ApiProperty({ enum: CalendarEntryKind, default: CalendarEntryKind.REMINDER })
  @IsOptional()
  @IsEnum(CalendarEntryKind)
  kind: CalendarEntryKind = CalendarEntryKind.REMINDER;

  @ApiProperty({
    example: 'Encerramento do periodo de experiencia'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title!: string;

  @ApiPropertyOptional({
    example: 'Conferir documentos e decidir renovacao antes do encerramento.'
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    example: 'PROBATION_END',
    description:
      'Classificacao livre para filtrar a agenda: aniversario, experiencia, recado, feriado etc.'
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value
  )
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional({
    example: 'YEARLY',
    description:
      'Regra simples de repeticao. Use YEARLY para itens anuais ainda vigentes.'
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value
  )
  @IsIn(['NONE', 'YEARLY'])
  recurrenceRule?: 'NONE' | 'YEARLY';

  @ApiProperty({
    example: '2026-05-01',
    description: 'Data alvo do lembrete/compromisso. Aceita ISO, YYYY-MM-DD ou DD/MM/AAAA.'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  startsAt!: string;

  @ApiPropertyOptional({
    example: '2026-05-01T10:00:00-03:00'
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  endsAt?: string;

  @ApiPropertyOptional({ default: 'America/Sao_Paulo' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(64)
  timezone = 'America/Sao_Paulo';

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isAllDay = false;

  @ApiPropertyOptional({ enum: CalendarEntryPriority })
  @IsOptional()
  @IsEnum(CalendarEntryPriority)
  priority: CalendarEntryPriority = CalendarEntryPriority.NORMAL;

  @ApiPropertyOptional({ enum: CalendarEntryStatus })
  @IsOptional()
  @IsEnum(CalendarEntryStatus)
  status: CalendarEntryStatus = CalendarEntryStatus.SCHEDULED;

  @ApiPropertyOptional({ enum: CalendarBusinessDayPolicy })
  @IsOptional()
  @IsEnum(CalendarBusinessDayPolicy)
  businessDayPolicy: CalendarBusinessDayPolicy =
    CalendarBusinessDayPolicy.ALLOW_NON_BUSINESS_DAY;

  @ApiPropertyOptional({
    example: 'BR-SP',
    description: 'Codigo futuro para calendario de feriados regional.'
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(40)
  holidayRegionCode?: string;

  @ApiPropertyOptional({ enum: CalendarNotificationPolicy })
  @IsOptional()
  @IsEnum(CalendarNotificationPolicy)
  notificationPolicy: CalendarNotificationPolicy =
    CalendarNotificationPolicy.ONE_BUSINESS_DAY_BEFORE;

  @ApiPropertyOptional({
    default: 1,
    description:
      'Usado quando notificationPolicy = CUSTOM_BUSINESS_DAYS_BEFORE.'
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  notificationOffsetBusinessDays = 1;

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  notificationTime = '09:00';

  @ApiPropertyOptional({
    enum: calendarNotificationChannels,
    isArray: true,
    default: ['IN_APP', 'EMAIL']
  })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
          .map((item) => (typeof item === 'string' ? item.trim().toUpperCase() : item))
          .filter((item) => typeof item === 'string' && item.length > 0)
      : value
  )
  @IsArray()
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsIn(calendarNotificationChannels, { each: true })
  notificationChannels?: CalendarNotificationChannel[];

  @ApiPropertyOptional({
    enum: AccessProfileCode,
    isArray: true,
    description:
      'Perfis que receberao recados de agenda por canais configurados, como RH ou Operacoes.'
  })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
          .map((item) =>
            typeof item === 'string' ? item.trim().toUpperCase() : item
          )
          .filter((item) => typeof item === 'string' && item.length > 0)
      : value
  )
  @IsArray()
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsEnum(AccessProfileCode, { each: true })
  audienceProfileCodes?: AccessProfileCode[];

  @ApiPropertyOptional({
    isArray: true,
    example: ['tct_01hxyzabc123def456ghi789']
  })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
          .map((item) => (typeof item === 'string' ? item.trim() : item))
          .filter((item) => typeof item === 'string' && item.length > 0)
      : value
  )
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(26, { each: true })
  audienceContractTypePublicIds?: string[];

  @ApiPropertyOptional({ example: 'pes_01hxyzabc123def456ghi789' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  personPublicId?: string;

  @ApiPropertyOptional({ example: 'epr_01hxyzabc123def456ghi789' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  providerCompanyPublicId?: string;

  @ApiPropertyOptional({ example: 'cli_01hxyzabc123def456ghi789' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  clientCompanyPublicId?: string;

  @ApiPropertyOptional({ example: 'ctr_01hxyzabc123def456ghi789' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  contractPublicId?: string;

  @ApiPropertyOptional({ example: 'vin_01hxyzabc123def456ghi789' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  employmentLinkPublicId?: string;

  @ApiPropertyOptional({ example: 'pos_01hxyzabc123def456ghi789' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  positionPublicId?: string;
}
