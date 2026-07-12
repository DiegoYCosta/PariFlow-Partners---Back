import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FocusBoardCompletionMode,
  FocusBoardNoteKind,
  FocusBoardNotePriority,
  FocusBoardNoteVisibility
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';
import { FocusBoardNoteContextDto } from './focus-board-note-context.dto';
import { FocusBoardNoteParticipantDto } from './focus-board-note-participant.dto';

export class CreateFocusBoardNoteDto {
  @ApiPropertyOptional({ enum: FocusBoardNoteKind, default: FocusBoardNoteKind.NOTE })
  @IsOptional()
  @IsEnum(FocusBoardNoteKind)
  kind: FocusBoardNoteKind = FocusBoardNoteKind.NOTE;

  @ApiProperty({ example: 'Revisar documentos para cliente X' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  title!: string;

  @ApiPropertyOptional({ example: 'Conferir ASO antes da reuniao.' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(4000)
  body?: string;

  @ApiPropertyOptional({
    enum: FocusBoardNotePriority,
    default: FocusBoardNotePriority.NORMAL
  })
  @IsOptional()
  @IsEnum(FocusBoardNotePriority)
  priority: FocusBoardNotePriority = FocusBoardNotePriority.NORMAL;

  @ApiPropertyOptional({
    enum: FocusBoardNoteVisibility,
    default: FocusBoardNoteVisibility.PRIVATE
  })
  @IsOptional()
  @IsEnum(FocusBoardNoteVisibility)
  visibility: FocusBoardNoteVisibility = FocusBoardNoteVisibility.PRIVATE;

  @ApiPropertyOptional({
    enum: FocusBoardCompletionMode,
    default: FocusBoardCompletionMode.OWNER_ONLY
  })
  @IsOptional()
  @IsEnum(FocusBoardCompletionMode)
  completionMode: FocusBoardCompletionMode =
    FocusBoardCompletionMode.OWNER_ONLY;

  @ApiPropertyOptional({ example: '2026-07-15T12:00:00-03:00' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(40)
  dueAt?: string;

  @ApiPropertyOptional({ example: 'fcn_01hxyzabc123def456ghi789' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  parentNotePublicId?: string;

  @ApiPropertyOptional({ example: 'local-v1:device:note-123' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  clientMigrationId?: string;

  @ApiPropertyOptional({ type: FocusBoardNoteContextDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => FocusBoardNoteContextDto)
  contexts?: FocusBoardNoteContextDto[];

  @ApiPropertyOptional({ type: FocusBoardNoteParticipantDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => FocusBoardNoteParticipantDto)
  participants?: FocusBoardNoteParticipantDto[];
}
