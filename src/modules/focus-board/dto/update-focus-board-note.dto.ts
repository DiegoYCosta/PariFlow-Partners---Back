import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator';
import { CreateFocusBoardNoteDto } from './create-focus-board-note.dto';

export class UpdateFocusBoardNoteDto extends PartialType(
  CreateFocusBoardNoteDto
) {
  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999999)
  expectedVersion?: number;

  @ApiPropertyOptional({ example: 'Atualizacao solicitada pelo DP.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  editJustification?: string;
}
