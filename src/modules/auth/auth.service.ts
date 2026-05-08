import {
  Injectable,
  Inject,
  NotImplementedException,
  UnauthorizedException
} from '@nestjs/common';
import { AccessProfileCode, SensitiveAudienceGroup } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { createPublicId } from '../../common/utils/public-id';
import { databaseUrl, env } from '../../config/env';
import { PrismaService } from '../../infra/database/prisma.service';
import { FirebaseAdminService } from '../../infra/firebase/firebase-admin.service';
import { SessionExchangeDto } from './dto/session-exchange.dto';
import {
  AuthCapabilities,
  AuthTokenPayload
} from './interfaces/auth-token-payload.interface';

type SessionIdentity = {
  firebaseUid: string;
  nome: string;
  email: string | null;
};

type SessionUser = SessionIdentity & {
  publicId: string;
};

type SessionRequestContext = {
  forwardedFor?: string | string[];
  forwardedHost?: string | string[];
  host?: string;
  origin?: string;
  remoteAddress?: string;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Inject(FirebaseAdminService)
    private readonly firebaseAdminService: FirebaseAdminService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async exchangeFirebaseSession(
    dto: SessionExchangeDto,
    requestContext?: SessionRequestContext
  ) {
    const identity = await this.resolveSessionIdentity(
      dto.firebaseIdToken,
      requestContext
    );
    const sessionSnapshot = await this.resolveSessionSnapshot(identity);

    const payload: AuthTokenPayload = {
      sub: sessionSnapshot.user.publicId,
      firebaseUid: sessionSnapshot.user.firebaseUid,
      email: sessionSnapshot.user.email,
      profiles: sessionSnapshot.profiles,
      audienceGroups: sessionSnapshot.audienceGroups,
      securityContext: sessionSnapshot.securityContext,
      capabilities: sessionSnapshot.capabilities
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: env.JWT_ACCESS_SECRET,
      expiresIn: `${env.JWT_ACCESS_TTL_MINUTES}m`
    });

    // Esse snapshot precisa sair suficiente para o front montar sessao,
    // navegacao e bloqueios iniciais sem adivinhar permissao na interface.
    return {
      accessToken,
      expiresInSeconds: env.JWT_ACCESS_TTL_MINUTES * 60,
      securityContext: sessionSnapshot.securityContext,
      profiles: sessionSnapshot.profiles,
      audienceGroups: sessionSnapshot.audienceGroups,
      capabilities: sessionSnapshot.capabilities,
      user: sessionSnapshot.user
    };
  }

  async getCurrentUser(payload: AuthTokenPayload) {
    // Mantem o formato vizinho ao exchange para o front reidratar sessao sem
    // precisar abrir mapa de compatibilidade entre login e sessao corrente.
    return {
      user: {
        publicId: payload.sub,
        firebaseUid: payload.firebaseUid,
        email: payload.email
      },
      securityContext: payload.securityContext,
      profiles: payload.profiles,
      audienceGroups: payload.audienceGroups,
      capabilities: payload.capabilities
    };
  }

  async refreshSession() {
    // Quando o ciclo de sessao interna estiver completo, este endpoint passa a
    // rotacionar refresh_tokens persistidos e a renovar o contexto do usuario.
    throw new NotImplementedException(
      'Refresh token rotativo ainda nao foi habilitado.'
    );
  }

  async logout() {
    throw new NotImplementedException(
      'Logout com revogacao de sessao ainda nao foi habilitado.'
    );
  }

  async startSensitiveSession() {
    // A documentacao preve step-up para anexos, downloads e relatorios criticos.
    // Esse fluxo sera ligado as tabelas sensitive_sessions e security_events.
    throw new NotImplementedException(
      'Sessao sensivel ainda nao foi habilitada.'
    );
  }

  async verifySensitiveSession() {
    throw new NotImplementedException(
      'Verificacao de sessao sensivel ainda nao foi habilitada.'
    );
  }

  private async resolveSessionIdentity(
    firebaseIdToken: string,
    requestContext?: SessionRequestContext
  ): Promise<SessionIdentity> {
    const canUseDevelopmentBypass =
      firebaseIdToken === 'dev-token' &&
      env.NODE_ENV !== 'production' &&
      (env.DEV_AUTH_BYPASS || env.PREVIEW_AUTH_BYPASS) &&
      this.isLocalDevelopmentRequest(requestContext);

    if (canUseDevelopmentBypass) {
      return {
        firebaseUid: 'firebase-dev-local',
        nome: 'Desenvolvimento Local',
        email: 'dev@local.test'
      };
    }

    const decodedToken =
      await this.firebaseAdminService.verifyIdToken(firebaseIdToken);

    const email = decodedToken.email ?? null;

    if (!email) {
      throw new UnauthorizedException(
        'O token validado nao possui e-mail associado.'
      );
    }

    return {
      firebaseUid: decodedToken.uid,
      nome:
        typeof decodedToken.name === 'string' && decodedToken.name.length > 0
          ? decodedToken.name
          : email,
      email
    };
  }

  private async resolveSessionSnapshot(identity: SessionIdentity): Promise<{
    user: SessionUser;
    profiles: string[];
    audienceGroups: SensitiveAudienceGroup[];
    capabilities: AuthCapabilities;
    securityContext: AuthTokenPayload['securityContext'];
  }> {
    if (!databaseUrl) {
      // Esse fallback segura o contrato de auth enquanto banco e Firebase ainda
      // estao fechando, para o front conseguir subir fluxo e validacao basica.
      const isLocalDevelopmentIdentity = identity.firebaseUid === 'firebase-dev-local';
      const localProfiles = isLocalDevelopmentIdentity ? ['admin'] : [];
      const audienceGroups = this.resolveAudienceGroupsFromProfileKeys(localProfiles);
      const capabilities = isLocalDevelopmentIdentity
        ? {
            canViewSensitive: true,
            canDownloadAttachments: true,
            canSoftDeleteAttachment: true
          }
        : this.buildCapabilities([]);

      return {
        user: {
          publicId: identity.firebaseUid === 'firebase-dev-local'
            ? 'usr_dev_local'
            : createUserPublicId(),
          ...identity
        },
        profiles: localProfiles,
        audienceGroups,
        capabilities,
        securityContext: this.resolveSecurityContext(localProfiles, capabilities)
      };
    }

    const persistedUser = await this.upsertInternalUser(identity);
    const profiles = await this.loadUserProfiles(persistedUser.id);

    if (
      env.NODE_ENV !== 'production' &&
      identity.firebaseUid === 'firebase-dev-local' &&
      profiles.length === 0
    ) {
      const localProfiles = ['admin'];
      const capabilities = {
        canViewSensitive: true,
        canDownloadAttachments: true,
        canSoftDeleteAttachment: true
      };

      return {
        user: {
          publicId: persistedUser.publicId,
          firebaseUid: persistedUser.firebaseUid ?? identity.firebaseUid,
          nome: persistedUser.name,
          email: persistedUser.email
        },
        profiles: localProfiles,
        audienceGroups: this.resolveAudienceGroupsFromProfileKeys(localProfiles),
        capabilities,
        securityContext: 'privileged'
      };
    }

    const capabilities = this.buildCapabilities(profiles);
    const audienceGroups = this.resolveAudienceGroupsFromProfiles(profiles);

    return {
      user: {
        publicId: persistedUser.publicId,
        firebaseUid: persistedUser.firebaseUid ?? identity.firebaseUid,
        nome: persistedUser.name,
        email: persistedUser.email
      },
      profiles: profiles.map((profile) =>
        this.mapProfileCode(profile.accessProfile.code)
      ),
      audienceGroups,
      capabilities,
      securityContext: this.resolveSecurityContext(profiles, capabilities)
    };
  }

  private async upsertInternalUser(identity: SessionIdentity) {
    const existingUser = await this.prisma.userSystem.findFirst({
      where: {
        OR: [
          { firebaseUid: identity.firebaseUid },
          ...(identity.email ? [{ email: identity.email }] : [])
        ]
      }
    });

    if (existingUser) {
      return this.prisma.userSystem.update({
        where: { id: existingUser.id },
        data: {
          firebaseUid: identity.firebaseUid,
          name: identity.nome,
          email: identity.email ?? existingUser.email,
          lastAccessAt: new Date()
        }
      });
    }

    if (!identity.email) {
      throw new UnauthorizedException(
        'O token validado nao possui informacoes suficientes para criar usuario interno.'
      );
    }

    return this.prisma.userSystem.create({
      data: {
        publicId: createUserPublicId(),
        firebaseUid: identity.firebaseUid,
        name: identity.nome,
        email: identity.email,
        status: 'ACTIVE',
        lastAccessAt: new Date()
      }
    });
  }

  private async loadUserProfiles(userSystemId: bigint) {
    return this.prisma.userAccessProfile.findMany({
      where: { userSystemId },
      include: {
        accessProfile: true
      }
    });
  }

  // O front consome essas capacidades diretamente para montar navegacao e
  // bloqueios de interface sem depender de regra duplicada no cliente.
  private buildCapabilities(
    profiles: Array<{
      accessProfile: {
        canViewSensitive: boolean;
        canDownload: boolean;
        canSoftDelete: boolean;
      };
    }>
  ): AuthCapabilities {
    return {
      canViewSensitive: profiles.some(
        (profile) => profile.accessProfile.canViewSensitive
      ),
      canDownloadAttachments: profiles.some(
        (profile) => profile.accessProfile.canDownload
      ),
      canSoftDeleteAttachment: profiles.some(
        (profile) => profile.accessProfile.canSoftDelete
      )
    };
  }

  private resolveSecurityContext(
    profiles: Array<unknown>,
    _capabilities: AuthCapabilities
  ): AuthTokenPayload['securityContext'] {
    if (profiles.length > 0) {
      return 'privileged';
    }

    return 'authenticated';
  }

  private resolveAudienceGroupsFromProfiles(
    profiles: Array<{
      accessProfile: {
        code: AccessProfileCode;
      };
    }>
  ): SensitiveAudienceGroup[] {
    return this.uniqueAudienceGroups(
      profiles.flatMap((profile) => {
        switch (profile.accessProfile.code) {
          case AccessProfileCode.ADMIN:
          case AccessProfileCode.EXECUTIVE:
            return [SensitiveAudienceGroup.DIRECTOR];
          case AccessProfileCode.LEGAL:
          case AccessProfileCode.HR:
          case AccessProfileCode.OPERATIONS:
            return [SensitiveAudienceGroup.SUPERVISION];
          default:
            return [];
        }
      })
    );
  }

  private resolveAudienceGroupsFromProfileKeys(
    profileKeys: string[]
  ): SensitiveAudienceGroup[] {
    return this.uniqueAudienceGroups(
      profileKeys.flatMap((profileKey) => {
        switch (profileKey) {
          case 'admin':
          case 'executive':
            return [SensitiveAudienceGroup.DIRECTOR];
          case 'legal':
          case 'hr':
          case 'operations':
            return [SensitiveAudienceGroup.SUPERVISION];
          default:
            return [];
        }
      })
    );
  }

  private uniqueAudienceGroups(
    groups: SensitiveAudienceGroup[]
  ): SensitiveAudienceGroup[] {
    return Array.from(new Set(groups));
  }

  private mapProfileCode(code: AccessProfileCode): string {
    // Os nomes mapeados aqui acabam virando contrato de interface e feature flag.
    // Se trocar vocabulario, alinhar front e documentacao no mesmo movimento.
    switch (code) {
      case AccessProfileCode.ADMIN:
        return 'admin';
      case AccessProfileCode.EXECUTIVE:
        return 'executive';
      case AccessProfileCode.LEGAL:
        return 'legal';
      case AccessProfileCode.HR:
        return 'hr';
      case AccessProfileCode.OPERATIONS:
        return 'operations';
      default:
        return String(code).toLowerCase();
    }
  }

  private isLocalDevelopmentRequest(
    requestContext?: SessionRequestContext
  ): boolean {
    if (!requestContext) {
      return false;
    }

    const originHosts = this.resolveHostnames(requestContext.origin);
    if (originHosts.length > 0 && !originHosts.every(isLocalHostname)) {
      return false;
    }

    const forwardedHosts = this.resolveHostnames(requestContext.forwardedHost);
    if (
      forwardedHosts.length > 0 &&
      !forwardedHosts.every(isLocalHostname)
    ) {
      return false;
    }

    const hostNames = this.resolveHostnames(requestContext.host);
    if (hostNames.length === 0 || !hostNames.every(isLocalHostname)) {
      return false;
    }

    const forwardedAddresses = this.resolveHeaderValues(
      requestContext.forwardedFor
    );
    if (
      forwardedAddresses.length > 0 &&
      !forwardedAddresses.every(isLocalRemoteAddress)
    ) {
      return false;
    }

    return isLocalRemoteAddress(requestContext.remoteAddress);
  }

  private resolveHostnames(header?: string | string[]): string[] {
    return this.resolveHeaderValues(header)
      .map((value) => hostnameFromHeaderValue(value))
      .filter((hostname): hostname is string => Boolean(hostname));
  }

  private resolveHeaderValues(header?: string | string[]): string[] {
    const values = Array.isArray(header) ? header : header ? [header] : [];

    return values
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }
}

function createUserPublicId(): string {
  return createPublicId('usr');
}

function hostnameFromHeaderValue(value: string): string | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    const parsedUrl = new URL(
      trimmedValue.includes('://') ? trimmedValue : `http://${trimmedValue}`
    );

    return parsedUrl.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isLocalHostname(hostname: string): boolean {
  const normalizedHostname = hostname.replace(/^\[|\]$/g, '').toLowerCase();

  return ['localhost', '127.0.0.1', '::1'].includes(normalizedHostname);
}

function isLocalRemoteAddress(remoteAddress?: string): boolean {
  if (!remoteAddress) {
    return false;
  }

  const normalizedAddress = remoteAddress
    .trim()
    .replace(/^::ffff:/, '')
    .toLowerCase();

  return ['localhost', '127.0.0.1', '::1'].includes(normalizedAddress);
}
