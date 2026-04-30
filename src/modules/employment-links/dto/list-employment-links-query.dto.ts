import { ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentLinkStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListEmploymentLinksQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'pes_01hxyz...',
    description: 'Filtro por publicId da pessoa, no mesmo identificador exposto em listagem e detalhe.'
  })
  @IsOptional()
  @IsString()
  personPublicId?: string;

  @ApiPropertyOptional({
    example: 'epr_01hxyz...',
    description: 'Filtro por publicId da prestadora para compor telas multiempresa sem id interno.'
  })
  @IsOptional()
  @IsString()
  providerCompanyPublicId?: string;

  @ApiPropertyOptional({
    example: 'ctr_01hxyz...',
    description: 'Filtro por publicId do contrato, alinhado com os demais modulos relacionados.'
  })
  @IsOptional()
  @IsString()
  contractPublicId?: string;

  @ApiPropertyOptional({
    enum: EmploymentLinkStatus,
    example: EmploymentLinkStatus.ACTIVE,
    description: 'Status como enum de dominio. O front traduz a exibicao, mas preserva o valor tecnico.'
  })
  @IsOptional()
  @IsEnum(EmploymentLinkStatus)
  status?: EmploymentLinkStatus;

  @ApiPropertyOptional({
    example: 'CLT',
    description: 'Tipo de vinculo usado como filtro exato para manter previsibilidade de consulta.'
  })
  @IsOptional()
  @IsString()
  type?: string;
}
