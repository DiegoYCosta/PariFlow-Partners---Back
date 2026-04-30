import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Regra base das listas: repetir search/page/perPage em todos os modulos
// evita adapter por recurso e deixa o front reaproveitar estado e componentes.
export class PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Busca textual simples no recurso. A intencao é reaproveitar a mesma UX de busca entre listas.',
    example: 'PariFlow'
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description:
      'Pagina atual. Mantem base 1 em todos os modulos para o front nao precisar converter indice.',
    example: 1,
    default: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    description:
      'Quantidade de itens por pagina. O limite fica no backend para a listagem nao variar sem controle.',
    example: 20,
    default: 20
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage = 20;
}
