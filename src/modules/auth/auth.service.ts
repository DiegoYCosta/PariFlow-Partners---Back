import {
  Injectable,
  NotImplementedException,
  UnauthorizedException
} from '@nestjs/common';
import { AccessProfileCode } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ulid } from 'ulid';
import { createPublicId } from '../../common/utils/public-id';
import { env } from '../../config/env';
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

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly firebaseAdminService: FirebaseAdminService,
    private readonly prisma: PrismaService
  ) {}

  async exchangeFirebaseSession(dto: SessionExchangeDto) {
    const identity = await this.resolveSessionIdentity(dto.firebaseIdToken);
    const sessionSnapshot = await this.resolveSessionSnapshot(identity);

    const payload: AuthTokenPayload = {
      sub: sessionSnapshot.user.publicId,
      firebaseUid: sessionSnapshot.user.firebaseUid,
      email: sessionSnapshot.user.email,
      profiles: sessionSnapshot.profiles,
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
      capabilities: payload.capabilities
    };
  }

  async refreshSession() {
    // Quando o ciclo de sessão interna estiver completo, este endpoint passa a
    // rotacionar refresh_tokens persistidos e a renovar o contexto do usuário.
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
    // A documentação prevê step-up para anexos, downloads e relatórios críticos.
    // Esse fluxo será ligado às tabelas sensitive_sessions e security_events.
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
    firebaseIdToken: string
  ): Promise<SessionIdentity> {
    const canUseDevelopmentBypass =
      env.NODE_ENV !== 'production' &&
      (env.DEV_AUTH_BYPASS || !this.firebaseAdminService.isConfigured()) &&
      firebaseIdToken === 'dev-token';

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
    capabilities: AuthCapabilities;
    securityContext: AuthTokenPayload['securityContext'];
  }> {
    if (!env.DATABASE_URL) {
      // Esse fallback segura o contrato de auth enquanto banco e Firebase ainda
      // estao fechando, para o front conseguir subir fluxo e validacao basica.
      const isLocalDevelopmentIdentity = identity.firebaseUid === 'firebase-dev-local';
      const localProfiles = isLocalDevelopmentIdentity ? ['admin'] : [];
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
        capabilities,
        securityContext: this.resolveSecurityContext(localProfiles, capabilities)
      };
    }

    const persistedUser = await this.upsertInternalUser(identity);
    const profiles = await this.loadUserProfiles(persistedUser.id);
    const capabilities = this.buildCapabilities(profiles);

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

  // O front consome essas capacidades diretamente para montar navegação e
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
}

function createUserPublicId(): string {
  return createPublicId('usr');
}
