export interface AuthCapabilities {
  canViewSensitive: boolean;
  canDownloadAttachments: boolean;
  canSoftDeleteAttachment: boolean;
}

export interface AuthTokenPayload {
  sub: string;
  firebaseUid: string;
  email: string | null;
  profiles: string[];
  securityContext: 'authenticated' | 'privileged' | 'sensitive_verified' | 'critical_verified';
  capabilities: AuthCapabilities;
}
