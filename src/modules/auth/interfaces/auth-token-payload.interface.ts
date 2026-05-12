import { SensitiveAudienceGroup } from '@prisma/client';

export interface AuthCapabilities {
  canViewSensitive: boolean;
  canDownloadAttachments: boolean;
  canSoftDeleteAttachment: boolean;
}

export interface AuthTenantContext {
  publicId: string;
  tradeName: string;
  legalName: string;
  cnpj: string;
  status: string;
}

// Esse payload carrega o minimo que a interface precisa para montar navegacao
// e bloqueios iniciais sem roundtrip extra. A regra fina continua no backend.
export interface AuthTokenPayload {
  sub: string;
  firebaseUid: string;
  email: string | null;
  tenantRootCompany?: AuthTenantContext | null;
  profiles: string[];
  audienceGroups: SensitiveAudienceGroup[];
  securityContext:
    | 'authenticated'
    | 'privileged'
    | 'sensitive_verified'
    | 'critical_verified';
  capabilities: AuthCapabilities;
}
