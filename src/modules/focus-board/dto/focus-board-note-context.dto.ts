import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FocusBoardContextType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class FocusBoardNoteContextDto {
  @ApiProperty({ enum: FocusBoardContextType })
  @IsEnum(FocusBoardContextType)
  contextType!: FocusBoardContextType;

  @ApiPropertyOptional({ example: 'pes_01hxyzabc123def456ghi789' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(26)
  contextPublicId?: string;

  @ApiPropertyOptional({ example: 'Checklist operacional sem entidade formal' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  externalLabel?: string;
}
