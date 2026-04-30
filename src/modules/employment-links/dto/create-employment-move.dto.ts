import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength
} from 'class-validator';

export class CreateEmploymentMoveDto {
  @ApiProperty({
    example: 'TRANSFERENCIA',
    description: 'Tipo tecnico da movimentacao. O front pode rotular, mas nao deve inventar codigo paralelo.'
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  moveType!: string;

  @ApiPropertyOptional({
    example: 'Portaria principal'
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  origin?: string;

  @ApiPropertyOptional({
    example: 'Portaria do bloco B'
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  destination?: string;

  @ApiProperty({
    example: '2026-05-03T08:00:00.000Z',
    description: 'Data em ISO 8601 para o historico continuar ordenavel e auditavel.'
  })
  @IsString()
  @IsISO8601()
  movedAt!: string;

  @ApiPropertyOptional({
    example: 'Remanejamento operacional a pedido do cliente.'
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
