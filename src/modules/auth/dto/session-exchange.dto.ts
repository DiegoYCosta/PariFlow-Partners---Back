import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SessionExchangeDto {
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...',
    description: 'Firebase ID Token emitido pelo front.'
  })
  @IsString()
  @MinLength(3)
  firebaseIdToken!: string;
}
