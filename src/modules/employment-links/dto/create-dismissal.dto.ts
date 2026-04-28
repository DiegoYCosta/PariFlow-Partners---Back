import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

export class CreateDismissalDto {
  @ApiProperty({
    example: '2026-04-28T15:00:00.000Z'
  })
  @IsString()
  @IsISO8601()
  dismissedAt!: string;

  @ApiProperty({
    example: 'Encerramento do contrato com o posto atual.'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  reason!: string;

  @ApiPropertyOptional({
    example: 'SEM_JUSTA_CAUSA'
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  dismissalType?: string;

  @ApiPropertyOptional({
    example: 'Sem risco juridico identificado no desligamento.'
  })
  @IsOptional()
  @IsString()
  riskSummary?: string;

  @ApiPropertyOptional({
    example: 'Uniforme pendente de devolucao.'
  })
  @IsOptional()
  @IsString()
  pendingIssues?: string;

  @ApiPropertyOptional({
    example: 'Documentacao conferida no ato do desligamento.'
  })
  @IsOptional()
  @IsString()
  legalNotes?: string;
}
