import {
  ClientOnboardingCnpjStatus,
  ClientOnboardingContractType
} from '@prisma/client';

export const CLIENT_ONBOARDING_REVIEW_EMAIL = 'diego.c94@yahoo.com';

export const companyTypePresets = [
  { value: 'SERVICE_PROVIDER', label: 'Prestadora de servicos' },
  { value: 'CONDOMINIUM_MANAGER', label: 'Administradora ou condominio' },
  { value: 'CORPORATE_CLIENT', label: 'Cliente corporativo' },
  { value: 'CONSULTING', label: 'Consultoria' },
  { value: 'TECHNOLOGY', label: 'Tecnologia ou SaaS' },
  { value: 'OTHER', label: 'Outro' }
] as const;

export const companySizePresets = [
  { value: 'MEI', label: 'MEI' },
  { value: 'MICRO', label: 'Microempresa' },
  { value: 'SMALL', label: 'Pequena empresa' },
  { value: 'MEDIUM', label: 'Media empresa' },
  { value: 'LARGE', label: 'Grande empresa' },
  { value: 'ENTERPRISE', label: 'Enterprise' }
] as const;

export const accessLevelQuotaPresets = [
  { key: 'ADMIN', label: 'Administrador', defaultQuota: 1 },
  { key: 'EXECUTIVE', label: 'Alta gestao', defaultQuota: 1 },
  { key: 'LEGAL', label: 'Juridico', defaultQuota: 0 },
  { key: 'HR', label: 'RH estrategico', defaultQuota: 1 },
  { key: 'OPERATIONS', label: 'Operacao autorizada', defaultQuota: 3 }
] as const;

export const companyTypePresetValues = companyTypePresets.map(
  (item) => item.value
);

export const companySizePresetValues = companySizePresets.map(
  (item) => item.value
);

export const accessLevelQuotaKeys = accessLevelQuotaPresets.map(
  (item) => item.key
);

export type CnpjOnboardingRegistryEntry = {
  cnpj: string;
  status: ClientOnboardingCnpjStatus;
  commercialContactName: string;
  commercialContactEmail?: string;
  commercialContactPhone?: string;
  note: string;
};

export const cnpjOnboardingRegistry: CnpjOnboardingRegistryEntry[] = [
  {
    cnpj: '11222333000181',
    status: ClientOnboardingCnpjStatus.AVAILABLE,
    commercialContactName: 'Ana Comercial',
    commercialContactEmail: 'ana.comercial@pariflow.local',
    commercialContactPhone: '+5511990011001',
    note: 'CNPJ liberado para cliente ativo.'
  },
  {
    cnpj: '55666777000125',
    status: ClientOnboardingCnpjStatus.AVAILABLE,
    commercialContactName: 'Bruno Comercial',
    commercialContactEmail: 'bruno.comercial@pariflow.local',
    commercialContactPhone: '+5511990011002',
    note: 'CNPJ liberado para cliente ativo.'
  },
  {
    cnpj: '22333444000192',
    status: ClientOnboardingCnpjStatus.AVAILABLE_FOR_TEST,
    commercialContactName: 'Carla Demonstracao',
    commercialContactEmail: 'carla.demo@pariflow.local',
    commercialContactPhone: '+5511990011003',
    note: 'CNPJ liberado para acesso de demonstracao.'
  },
  {
    cnpj: '33444555000103',
    status: ClientOnboardingCnpjStatus.IN_USE,
    commercialContactName: 'Diego Costa',
    commercialContactEmail: 'diego.c94@yahoo.com',
    commercialContactPhone: '+5511990011004',
    note: 'CNPJ ja possui cadastro ou contrato ativo.'
  },
  {
    cnpj: '44555666000114',
    status: ClientOnboardingCnpjStatus.UNAVAILABLE,
    commercialContactName: 'Mesa Comercial',
    commercialContactEmail: 'comercial@pariflow.local',
    commercialContactPhone: '+5511990011005',
    note: 'CNPJ bloqueado para autoatendimento.'
  }
];

export function contractTypeForCnpjStatus(
  status: ClientOnboardingCnpjStatus
): ClientOnboardingContractType {
  switch (status) {
    case ClientOnboardingCnpjStatus.AVAILABLE:
      return ClientOnboardingContractType.ACTIVE_CLIENT;
    case ClientOnboardingCnpjStatus.AVAILABLE_FOR_TEST:
      return ClientOnboardingContractType.DEMO_ACCESS;
    case ClientOnboardingCnpjStatus.IN_USE:
    case ClientOnboardingCnpjStatus.UNAVAILABLE:
    default:
      return ClientOnboardingContractType.UNAVAILABLE;
  }
}
