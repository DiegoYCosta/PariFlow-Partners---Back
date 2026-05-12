import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class UpdateCurrentUserDto {
  @ApiPropertyOptional({
    example: {
      zipCode: '13000-000',
      street: 'Rua Exemplo',
      number: '100',
      district: 'Centro',
      city: 'Campinas',
      state: 'SP',
      regionCode: 'BR-SP-CAMPINAS'
    }
  })
  @IsOptional()
  @IsObject()
  addressJson?: Record<string, unknown>;
}
