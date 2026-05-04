import { PaginationQueryDto } from '../dto/pagination-query.dto';

export type PaginationArgs = {
  page: number;
  perPage: number;
  skip: number;
};

export function buildPaginationArgs(query: PaginationQueryDto): PaginationArgs {
  const rawPage = Number(query.page ?? 1);
  const rawPerPage = Number(query.perPage ?? 20);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
  const perPage =
    Number.isFinite(rawPerPage) && rawPerPage >= 1
      ? Math.min(rawPerPage, 100)
      : 20;

  return {
    page,
    perPage,
    skip: (page - 1) * perPage
  };
}

export function buildPaginationMeta(
  page: number,
  perPage: number,
  total: number
) {
  // A meta sai no mesmo eixo da query para o front manter cache, paginador
  // e leitura de lista sem conversao escondida entre modulos.
  return {
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage))
  };
}
