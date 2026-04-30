import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SessionExchangeDto {
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...',
    description:
      'Firebase ID Token emitido pelo login primario. O front troca isso pela sessao interna e segue nela.'
  })
  @IsString()
  @MinLength(3)
  firebaseIdToken!: string;
}
