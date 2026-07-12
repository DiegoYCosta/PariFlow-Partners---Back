import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  FocusBoardContextType,
  FocusBoardNoteKind,
  FocusBoardNotePriority,
  FocusBoardNoteStatus,
  FocusBoardNoteVisibility
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator';

export class ListFocusBoardNotesQueryDto {
  @ApiPropertyOptional({ enum: FocusBoardNoteStatus })
  @IsOptional()
  @IsEnum(FocusBoardNoteStatus)
  status?: FocusBoardNoteStatus;

  @ApiPropertyOptional({ enum: FocusBoardNoteKind })
  @IsOptional()
  @IsEnum(FocusBoardNoteKind)
  kind?: FocusBoardNoteKind;

  @ApiPropertyOptional({ enum: FocusBoardNoteVisibility })
  @IsOptional()
  @IsEnum(FocusBoardNoteVisibility)
  visibility?: FocusBoardNoteVisibility;

  @ApiPropertyOptional({ enum: FocusBoardNotePriority })
  @IsOptional()
  @IsEnum(FocusBoardNotePriority)
  priority?: FocusBoardNotePriority;

  @ApiPropertyOptional({ enum: FocusBoardContextType })
  @IsOptional()
  @IsEnum(FocusBoardContextType)
  contextType?: FocusBoardContextType;

  @ApiPropertyOptional({ example: 'pes_01hxyzabc123def456ghi789' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  contextPublicId?: string;

  @ApiPropertyOptional({ example: '2026-07-01T00:00:00-03:00' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(40)
  dueFrom?: string;

  @ApiPropertyOptional({ example: '2026-07-31T23:59:59-03:00' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(40)
  dueTo?: string;

  @ApiPropertyOptional({ example: '2026-07-01T00:00:00-03:00' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(40)
  updatedAfter?: string;

  @ApiPropertyOptional({ example: 'documentos' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80)
  search?: string;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 30;

  @ApiPropertyOptional({ example: 'fcn_01hxyzabc123def456ghi789' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(26)
  cursor?: string;
}
