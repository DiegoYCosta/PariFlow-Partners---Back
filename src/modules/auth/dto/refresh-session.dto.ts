import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class RefreshSessionDto {
  @ApiPropertyOptional({
    description:
      'Refresh token para clientes que nao usam cookie HttpOnly. Web deve preferir o cookie.'
  })
  @IsOptional()
  @IsString()
  @MinLength(32)
  refreshToken?: string;
}
