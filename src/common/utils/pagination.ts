import { PaginationQueryDto } from '../dto/pagination-query.dto';

export type PaginationArgs = {
  page: number;
  perPage: number;
  skip: number;
};

export function buildPaginationArgs(query: PaginationQueryDto): PaginationArgs {
  const page = query.page ?? 1;
  const perPage = query.perPage ?? 20;

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
  return {
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage))
  };
}
