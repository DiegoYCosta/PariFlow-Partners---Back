export const GLOBAL_SEARCH_TYPES = [
  'people',
  'provider_companies',
  'client_companies',
  'contracts',
  'positions'
] as const;

export type GlobalSearchType = (typeof GLOBAL_SEARCH_TYPES)[number];

export const GLOBAL_SEARCH_LABELS: Record<GlobalSearchType, string> = {
  people: 'Pessoas',
  provider_companies: 'Empresas prestadoras',
  client_companies: 'Clientes',
  contracts: 'Contratos',
  positions: 'Postos'
};
