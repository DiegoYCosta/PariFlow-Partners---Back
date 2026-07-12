import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FocusBoardParticipantRole,
  FocusBoardParticipantType,
  SensitiveAudienceGroup
} from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

export class FocusBoardNoteParticipantDto {
  @ApiProperty({ enum: FocusBoardParticipantType })
  @IsEnum(FocusBoardParticipantType)
  participantType!: FocusBoardParticipantType;

  @ApiPropertyOptional({ example: 'usr_01hxyzabc123def456ghi789' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  userPublicId?: string;

  @ApiPropertyOptional({ example: 'prf_01hxyzabc123def456ghi789' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  accessProfilePublicId?: string;

  @ApiPropertyOptional({ enum: SensitiveAudienceGroup })
  @IsOptional()
  @IsEnum(SensitiveAudienceGroup)
  audienceGroupKey?: SensitiveAudienceGroup;

  @ApiPropertyOptional({ enum: FocusBoardParticipantRole })
  @IsOptional()
  @IsEnum(FocusBoardParticipantRole)
  role: FocusBoardParticipantRole = FocusBoardParticipantRole.VIEWER;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  canComplete = false;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiredForCompletion = false;
}
