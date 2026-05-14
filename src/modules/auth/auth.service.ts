import { Injectable, Inject, UnauthorizedException } from "@nestjs/common";
import {
  AccessProfileCode,
  NotificationOutboxChannel,
  Prisma,
  RefreshTokenStatus,
  SecurityEventType,
  SensitiveAudienceGroup,
  SensitiveSessionLevel,
  SensitiveSessionStatus,
  UserSystemStatus,
} from "@prisma/client";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { createPublicId } from "../../common/utils/public-id";
import { databaseUrl, env } from "../../config/env";
import { PrismaService } from "../../infra/database/prisma.service";
import { FirebaseAdminService } from "../../infra/firebase/firebase-admin.service";
import { RequestCompanyAccessDto } from "./dto/request-company-access.dto";
import { SessionExchangeDto } from "./dto/session-exchange.dto";
import { StartSensitiveSessionDto } from "./dto/start-sensitive-session.dto";
import { UpdateCurrentUserDto } from "./dto/update-current-user.dto";
import { VerifySensitiveSessionDto } from "./dto/verify-sensitive-session.dto";
import {
  AuthCapabilities,
  AuthTenantContext,
  AuthTokenPayload,
} from "./interfaces/auth-token-payload.interface";

type SessionIdentity = {
  firebaseUid: string;
  nome: string;
  email: string | null;
};

type SessionUser = SessionIdentity & {
  publicId: string;
  tenantRootCompany?: AuthTenantContext | null;
  addressJson?: Prisma.JsonValue | null;
};

type SessionSnapshot = {
  user: SessionUser;
  userSystemId?: bigint;
  profiles: string[];
  audienceGroups: SensitiveAudienceGroup[];
  capabilities: AuthCapabilities;
  securityContext: AuthTokenPayload["securityContext"];
};

type SessionRequestContext = {
  forwardedFor?: string | string[];
  forwardedHost?: string | string[];
  host?: string;
  origin?: string;
  remoteAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Inject(FirebaseAdminService)
    private readonly firebaseAdminService: FirebaseAdminService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async exchangeFirebaseSession(
    dto: SessionExchangeDto,
    requestContext?: SessionRequestContext,
  ) {
    const identity = await this.resolveSessionIdentity(
      dto.firebaseIdToken,
      requestContext,
    );
    const sessionSnapshot = await this.resolveSessionSnapshot(identity);

    const accessToken = await this.signAccessToken(sessionSnapshot);
    const refreshToken = await this.issueRefreshToken(
      sessionSnapshot.userSystemId,
      requestContext,
    );
    await this.recordSecurityEvent(
      sessionSnapshot.userSystemId,
      SecurityEventType.SESSION_EXCHANGED,
      "Sessao interna emitida por token Firebase validado.",
      requestContext,
    );

    // Esse snapshot precisa sair suficiente para o front montar sessao,
    // navegacao e bloqueios iniciais sem adivinhar permissao na interface.
    return this.buildSessionResponse(
      sessionSnapshot,
      accessToken,
      refreshToken,
    );
  }

  async refreshSession(
    refreshToken?: string,
    requestContext?: SessionRequestContext,
  ) {
    if (!databaseUrl) {
      throw new UnauthorizedException(
        "Refresh token exige banco de dados configurado.",
      );
    }

    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token nao informado.");
    }

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash: hashRefreshToken(refreshToken),
      },
      include: {
        userSystem: true,
      },
    });

    if (!storedToken || storedToken.status !== RefreshTokenStatus.ACTIVE) {
      throw new UnauthorizedException("Refresh token invalido ou revogado.");
    }

    if (storedToken.expiresAt.getTime() <= Date.now()) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: {
          status: RefreshTokenStatus.EXPIRED,
        },
      });
      throw new UnauthorizedException("Refresh token expirado.");
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        status: RefreshTokenStatus.ROTATED,
        rotatedAt: new Date(),
      },
    });

    const sessionSnapshot = await this.resolvePersistedSessionSnapshot(
      storedToken.userSystem,
    );
    const accessToken = await this.signAccessToken(sessionSnapshot);
    const nextRefreshToken = await this.issueRefreshToken(
      storedToken.userSystemId,
      requestContext,
    );
    await this.recordSecurityEvent(
      storedToken.userSystemId,
      SecurityEventType.REFRESH_ROTATED,
      "Refresh token rotacionado e novo access token emitido.",
      requestContext,
    );

    return this.buildSessionResponse(
      sessionSnapshot,
      accessToken,
      nextRefreshToken,
    );
  }

  async getCurrentUser(payload: AuthTokenPayload) {
    const user = databaseUrl
      ? await this.prisma.userSystem.findUnique({
          where: { publicId: payload.sub },
          select: {
            publicId: true,
            firebaseUid: true,
            name: true,
            email: true,
            addressJson: true,
          },
        })
      : null;

    // Mantem o formato vizinho ao exchange para o front reidratar sessao sem
    // precisar abrir mapa de compatibilidade entre login e sessao corrente.
    return {
      user: {
        publicId: user?.publicId ?? payload.sub,
        firebaseUid: user?.firebaseUid ?? payload.firebaseUid,
        nome: user?.name ?? payload.email ?? "Sessao",
        email: user?.email ?? payload.email,
        addressJson: user?.addressJson ?? null,
        tenantRootCompany: payload.tenantRootCompany ?? null,
      },
      securityContext: payload.securityContext,
      profiles: payload.profiles,
      audienceGroups: payload.audienceGroups,
      capabilities: payload.capabilities,
    };
  }

  async updateCurrentUser(
    dto: UpdateCurrentUserDto,
    payload: AuthTokenPayload,
  ) {
    this.prisma.assertConfigured();

    await this.prisma.userSystem.update({
      where: { publicId: payload.sub },
      data: {
        addressJson:
          dto.addressJson === undefined
            ? undefined
            : (dto.addressJson as Prisma.InputJsonValue),
      },
    });

    return this.getCurrentUser(payload);
  }

  async requestCompanyAccess(
    dto: RequestCompanyAccessDto,
    payload: AuthTokenPayload,
    requestContext?: SessionRequestContext,
  ) {
    this.prisma.assertConfigured();

    const user = await this.prisma.userSystem.findUnique({
      where: { publicId: payload.sub },
      select: {
        id: true,
        publicId: true,
        email: true,
        name: true,
        tenantRootCompanyId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        "Usuario autenticado nao foi encontrado para solicitacao de acesso.",
      );
    }

    if (user.tenantRootCompanyId) {
      return {
        status: "ALREADY_LINKED",
        message: "Usuario ja possui empresa vinculada para acesso.",
      };
    }

    const now = new Date();
    const recentWindow = new Date(now.getTime() - 5 * 60 * 1000);
    const lookbackWindow = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const existingRequests = await this.prisma.notificationOutbox.findMany({
      where: {
        queuedAt: { gte: lookbackWindow },
      },
      orderBy: { queuedAt: "desc" },
      take: 200,
    });
    const matchingRequests = existingRequests.filter((item) =>
      this.isMatchingCompanyAccessRequest(
        item.metadataJson,
        user.publicId,
        dto.cnpj,
      ),
    );

    if (
      matchingRequests.some(
        (item) => item.queuedAt.getTime() >= recentWindow.getTime(),
      )
    ) {
      return {
        status: "RATE_LIMITED",
        message:
          "Voce ja enviou uma solicitacao ha menos de 5 minutos. Caso considere que algo esta errado, entre em contato com o suporte.",
      };
    }

    if (
      matchingRequests.some(
        (item) => !this.companyAccessRequestWasRejected(item.metadataJson),
      )
    ) {
      return {
        status: "DUPLICATE",
        message:
          "Pedido ja foi enviado anteriormente. Caso considere que algo esta errado, entre em contato com o suporte.",
      };
    }

    if (
      matchingRequests.some((item) =>
        this.companyAccessRequestWasRejected(item.metadataJson),
      )
    ) {
      return {
        status: "REJECTED",
        message: "Entre em contato com o suporte.",
      };
    }

    const supportTarget = env.SMTP_USER ?? dto.requesterEmail ?? payload.email;
    if (!supportTarget) {
      throw new UnauthorizedException(
        "Nao ha contato de destino configurado para solicitar acesso.",
      );
    }

    const message = [
      "Nova solicitacao de acesso a empresa.",
      "",
      `Usuario: ${user.name} (${user.email ?? "sem email"})`,
      `Solicitante: ${dto.requesterName}`,
      `Contato: ${dto.requesterEmail ?? "sem email"} | ${dto.requesterPhone ?? "sem telefone"}`,
      `Documento do solicitante: ${dto.requesterDocument}`,
      `CNPJ solicitado: ${dto.cnpj}`,
      `Nivel solicitado: ${dto.requestedAccessLevel}`,
      dto.notes ? `Observacoes: ${dto.notes}` : null,
    ]
      .filter((line): line is string => line !== null)
      .join("\n");

    await this.prisma.notificationOutbox.create({
      data: {
        publicId: createPublicId("not"),
        channel: NotificationOutboxChannel.EMAIL,
        target: supportTarget,
        subject: "Solicitacao de acesso a empresa PariFlow",
        message,
        metadataJson: {
          source: "company_access_request",
          reviewStatus: "PENDING",
          userPublicId: user.publicId,
          userEmail: user.email,
          cnpj: dto.cnpj,
          requesterDocument: dto.requesterDocument,
          requesterName: dto.requesterName,
          requesterEmail: dto.requesterEmail ?? null,
          requesterPhone: dto.requesterPhone ?? null,
          requestedAccessLevel: dto.requestedAccessLevel,
          requestIp: this.resolveClientIp(requestContext),
        } as Prisma.InputJsonValue,
      },
    });

    await this.recordSecurityEvent(
      user.id,
      SecurityEventType.SESSION_EXCHANGED,
      `Solicitacao de acesso enviada para CNPJ ${dto.cnpj}.`,
      requestContext,
      null,
    );

    return {
      status: "SUBMITTED",
      message:
        "Solicitacao enviada. A liberacao depende de aprovacao antes de qualquer acesso aos dados da empresa.",
    };
  }

  async logout(refreshToken?: string) {
    if (!databaseUrl || !refreshToken) {
      return { loggedOut: true };
    }

    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: hashRefreshToken(refreshToken),
        status: RefreshTokenStatus.ACTIVE,
      },
      data: {
        status: RefreshTokenStatus.REVOKED,
        revokedAt: new Date(),
      },
    });

    return { loggedOut: true };
  }

  async startSensitiveSession(
    dto: StartSensitiveSessionDto,
    payload: AuthTokenPayload,
    requestContext?: SessionRequestContext,
  ) {
    this.prisma.assertConfigured();

    const user = await this.prisma.userSystem.findUnique({
      where: { publicId: payload.sub },
      select: {
        id: true,
        publicId: true,
        email: true,
        tenantRootCompanyId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        "Usuario autenticado nao foi encontrado para sessao sensivel.",
      );
    }

    const code = randomInt(100000, 1000000).toString();
    const publicId = createPublicId("sen");
    const expiresAt = new Date(
      Date.now() + env.SENSITIVE_SESSION_TTL_MINUTES * 60 * 1000,
    );
    const level = dto.level ?? SensitiveSessionLevel.SENSITIVE;

    const session = await this.prisma.sensitiveSession.create({
      data: {
        publicId,
        userSystemId: user.id,
        level,
        status: SensitiveSessionStatus.PENDING,
        justification: dto.justification,
        challengeHash: hashSensitiveSessionCode(publicId, user.id, code),
        expiresAt,
        ipAddress: this.resolveClientIp(requestContext),
        userAgent: truncateForColumn(requestContext?.userAgent, 255),
      },
    });

    await this.prisma.notificationOutbox.create({
      data: {
        publicId: createPublicId("not"),
        tenantRootCompanyId: user.tenantRootCompanyId,
        channel: NotificationOutboxChannel.EMAIL,
        target: user.email,
        subject: "Codigo de sessao sensivel PariFlow Partners",
        message: `Seu codigo de acesso sensivel e ${code}. Ele expira em ${env.SENSITIVE_SESSION_TTL_MINUTES} minutos.`,
        metadataJson: {
          source: "sensitive_session",
          sensitiveSessionPublicId: publicId,
          level,
        } as Prisma.InputJsonValue,
      },
    });

    await this.recordSecurityEvent(
      user.id,
      SecurityEventType.SENSITIVE_SESSION_STARTED,
      `Sessao sensivel solicitada (${level}).`,
      requestContext,
      user.tenantRootCompanyId,
    );

    return {
      publicId: session.publicId,
      level: session.level,
      status: session.status,
      expiresAt: session.expiresAt,
      delivery: {
        channel: "EMAIL",
        targetMasked: maskEmail(user.email),
      },
      ...(env.NODE_ENV !== "production" ? { devCode: code } : {}),
    };
  }

  async verifySensitiveSession(
    dto: VerifySensitiveSessionDto,
    payload: AuthTokenPayload,
    requestContext?: SessionRequestContext,
  ) {
    this.prisma.assertConfigured();

    const user = await this.prisma.userSystem.findUnique({
      where: { publicId: payload.sub },
      select: { id: true, tenantRootCompanyId: true },
    });

    if (!user) {
      throw new UnauthorizedException(
        "Usuario autenticado nao foi encontrado para validar sessao sensivel.",
      );
    }

    const session = await this.prisma.sensitiveSession.findFirst({
      where: {
        publicId: dto.publicId,
        userSystemId: user.id,
        status: SensitiveSessionStatus.PENDING,
      },
    });

    if (!session) {
      throw new UnauthorizedException("Sessao sensivel invalida ou ja usada.");
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.sensitiveSession.update({
        where: { id: session.id },
        data: { status: SensitiveSessionStatus.EXPIRED },
      });
      throw new UnauthorizedException("Codigo de sessao sensivel expirado.");
    }

    const expectedHash = hashSensitiveSessionCode(
      session.publicId,
      user.id,
      dto.code,
    );

    if (session.challengeHash !== expectedHash) {
      await this.prisma.sensitiveSession.update({
        where: { id: session.id },
        data: {
          attemptCount: { increment: 1 },
          ...(session.attemptCount >= 4
            ? { status: SensitiveSessionStatus.REVOKED }
            : {}),
        },
      });
      throw new UnauthorizedException("Codigo de sessao sensivel invalido.");
    }

    const verified = await this.prisma.sensitiveSession.update({
      where: { id: session.id },
      data: {
        status: SensitiveSessionStatus.VERIFIED,
        verifiedAt: new Date(),
        challengeHash: null,
      },
    });

    await this.recordSecurityEvent(
      user.id,
      SecurityEventType.SENSITIVE_SESSION_VERIFIED,
      `Sessao sensivel verificada (${verified.level}).`,
      requestContext,
      user.tenantRootCompanyId,
    );

    return {
      publicId: verified.publicId,
      level: verified.level,
      status: verified.status,
      verifiedAt: verified.verifiedAt,
      expiresAt: verified.expiresAt,
    };
  }

  private async resolveSessionIdentity(
    firebaseIdToken: string,
    requestContext?: SessionRequestContext,
  ): Promise<SessionIdentity> {
    const canUseDevelopmentBypass =
      firebaseIdToken === "dev-token" &&
      env.NODE_ENV !== "production" &&
      (env.DEV_AUTH_BYPASS || env.PREVIEW_AUTH_BYPASS) &&
      this.isLocalDevelopmentRequest(requestContext);

    if (canUseDevelopmentBypass) {
      return {
        firebaseUid: "firebase-dev-local",
        nome: "Desenvolvimento Local",
        email: "dev@local.test",
      };
    }

    const decodedToken =
      await this.firebaseAdminService.verifyIdToken(firebaseIdToken);

    const email = decodedToken.email ?? null;

    if (!email) {
      throw new UnauthorizedException(
        "O token validado nao possui e-mail associado.",
      );
    }

    return {
      firebaseUid: decodedToken.uid,
      nome:
        typeof decodedToken.name === "string" && decodedToken.name.length > 0
          ? decodedToken.name
          : email,
      email,
    };
  }

  private async resolveSessionSnapshot(
    identity: SessionIdentity,
  ): Promise<SessionSnapshot> {
    if (!databaseUrl) {
      // Esse fallback segura o contrato de auth enquanto banco e Firebase ainda
      // estao fechando, para o front conseguir subir fluxo e validacao basica.
      const isLocalDevelopmentIdentity =
        identity.firebaseUid === "firebase-dev-local";
      const localProfiles = isLocalDevelopmentIdentity ? ["admin"] : [];
      const audienceGroups =
        this.resolveAudienceGroupsFromProfileKeys(localProfiles);
      const capabilities = isLocalDevelopmentIdentity
        ? {
            canViewSensitive: true,
            canDownloadAttachments: true,
            canSoftDeleteAttachment: true,
          }
        : this.buildCapabilities([]);

      return {
        user: {
          publicId:
            identity.firebaseUid === "firebase-dev-local"
              ? "usr_dev_local"
              : createUserPublicId(),
          tenantRootCompany: null,
          ...identity,
        },
        profiles: localProfiles,
        audienceGroups,
        capabilities,
        securityContext: this.resolveSecurityContext(
          localProfiles,
          capabilities,
        ),
      };
    }

    const persistedUser = await this.upsertInternalUser(identity);
    const profiles = await this.loadUserProfiles(persistedUser.id);

    if (
      env.NODE_ENV !== "production" &&
      identity.firebaseUid === "firebase-dev-local" &&
      profiles.length === 0
    ) {
      const localProfiles = ["admin"];
      const capabilities = {
        canViewSensitive: true,
        canDownloadAttachments: true,
        canSoftDeleteAttachment: true,
      };

      return {
        user: {
          publicId: persistedUser.publicId,
          firebaseUid: persistedUser.firebaseUid ?? identity.firebaseUid,
          nome: persistedUser.name,
          email: persistedUser.email,
          addressJson: persistedUser.addressJson ?? null,
          tenantRootCompany: null,
        },
        userSystemId: persistedUser.id,
        profiles: localProfiles,
        audienceGroups:
          this.resolveAudienceGroupsFromProfileKeys(localProfiles),
        capabilities,
        securityContext: "privileged",
      };
    }

    return this.resolvePersistedSessionSnapshot(persistedUser);
  }

  private async upsertInternalUser(identity: SessionIdentity) {
    const existingUser = await this.prisma.userSystem.findFirst({
      where: {
        OR: [
          { firebaseUid: identity.firebaseUid },
          ...(identity.email ? [{ email: identity.email }] : []),
        ],
      },
    });

    if (existingUser) {
      return this.prisma.userSystem.update({
        where: { id: existingUser.id },
        data: {
          firebaseUid: identity.firebaseUid,
          name: identity.nome,
          email: identity.email ?? existingUser.email,
          lastAccessAt: new Date(),
        },
      });
    }

    if (!identity.email) {
      throw new UnauthorizedException(
        "O token validado nao possui informacoes suficientes para criar usuario interno.",
      );
    }

    return this.prisma.userSystem.create({
      data: {
        publicId: createUserPublicId(),
        firebaseUid: identity.firebaseUid,
        name: identity.nome,
        email: identity.email,
        status: "ACTIVE",
        lastAccessAt: new Date(),
      },
    });
  }

  private async loadUserProfiles(userSystemId: bigint) {
    return this.prisma.userAccessProfile.findMany({
      where: { userSystemId },
      include: {
        accessProfile: true,
      },
    });
  }

  private async resolvePersistedSessionSnapshot(persistedUser: {
    id: bigint;
    publicId: string;
    firebaseUid: string | null;
    name: string;
    email: string | null;
    addressJson?: Prisma.JsonValue | null;
    status: UserSystemStatus;
  }): Promise<SessionSnapshot> {
    if (persistedUser.status !== UserSystemStatus.ACTIVE) {
      throw new UnauthorizedException(
        "Usuario interno ainda nao esta ativo para acessar o sistema.",
      );
    }

    const userWithTenant = await this.prisma.userSystem.findUnique({
      where: { id: persistedUser.id },
      include: {
        tenantRootCompany: true,
      },
    });
    const profiles = await this.loadUserProfiles(persistedUser.id);
    const capabilities = this.buildCapabilities(profiles);
    const audienceGroups = this.resolveAudienceGroupsFromProfiles(profiles);
    const tenantRootCompany = userWithTenant?.tenantRootCompany
      ? {
          publicId: userWithTenant.tenantRootCompany.publicId,
          tradeName: userWithTenant.tenantRootCompany.tradeName,
          legalName: userWithTenant.tenantRootCompany.legalName,
          cnpj: userWithTenant.tenantRootCompany.cnpj,
          status: userWithTenant.tenantRootCompany.status,
        }
      : null;

    return {
      user: {
        publicId: persistedUser.publicId,
        firebaseUid: persistedUser.firebaseUid ?? "",
        nome: persistedUser.name,
        email: persistedUser.email,
        addressJson: userWithTenant?.addressJson ?? null,
        tenantRootCompany,
      },
      userSystemId: persistedUser.id,
      profiles: profiles.map((profile) =>
        this.mapProfileCode(profile.accessProfile.code),
      ),
      audienceGroups,
      capabilities,
      securityContext: this.resolveSecurityContext(profiles, capabilities),
    };
  }

  private async signAccessToken(sessionSnapshot: SessionSnapshot) {
    const payload: AuthTokenPayload = {
      sub: sessionSnapshot.user.publicId,
      firebaseUid: sessionSnapshot.user.firebaseUid,
      email: sessionSnapshot.user.email,
      tenantRootCompany: sessionSnapshot.user.tenantRootCompany ?? null,
      profiles: sessionSnapshot.profiles,
      audienceGroups: sessionSnapshot.audienceGroups,
      securityContext: sessionSnapshot.securityContext,
      capabilities: sessionSnapshot.capabilities,
    };

    return this.jwtService.signAsync(payload, {
      secret: env.JWT_ACCESS_SECRET,
      expiresIn: `${env.JWT_ACCESS_TTL_MINUTES}m`,
    });
  }

  private buildSessionResponse(
    sessionSnapshot: SessionSnapshot,
    accessToken: string,
    refreshToken?: string,
  ) {
    return {
      accessToken,
      refreshToken,
      expiresInSeconds: env.JWT_ACCESS_TTL_MINUTES * 60,
      refreshExpiresInSeconds: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60,
      securityContext: sessionSnapshot.securityContext,
      profiles: sessionSnapshot.profiles,
      audienceGroups: sessionSnapshot.audienceGroups,
      capabilities: sessionSnapshot.capabilities,
      user: sessionSnapshot.user,
    };
  }

  private async issueRefreshToken(
    userSystemId?: bigint,
    requestContext?: SessionRequestContext,
  ) {
    if (!databaseUrl || !userSystemId) {
      return undefined;
    }

    const refreshToken = createRefreshTokenValue();
    const expiresAt = new Date(
      Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.refreshToken.create({
      data: {
        publicId: createPublicId("rft"),
        userSystemId,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt,
        ipAddress: this.resolveClientIp(requestContext),
        userAgent: truncateForColumn(requestContext?.userAgent, 255),
      },
    });

    return refreshToken;
  }

  private async recordSecurityEvent(
    userSystemId: bigint | undefined,
    eventType: SecurityEventType,
    description: string,
    requestContext?: SessionRequestContext,
    tenantRootCompanyId?: bigint | null,
  ) {
    if (!databaseUrl || !userSystemId) {
      return;
    }

    try {
      await this.prisma.securityEvent.create({
        data: {
          publicId: createPublicId("sev"),
          tenantRootCompanyId,
          userSystemId,
          eventType,
          description,
          ipAddress: this.resolveClientIp(requestContext),
          userAgent: truncateForColumn(requestContext?.userAgent, 255),
        },
      });
    } catch {
      // Evento de seguranca nao pode quebrar login ou refresh.
    }
  }

  private isMatchingCompanyAccessRequest(
    metadata: Prisma.JsonValue,
    userPublicId: string,
    cnpj: string,
  ) {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return false;
    }

    const item = metadata as Record<string, unknown>;
    return (
      item.source === "company_access_request" &&
      item.userPublicId === userPublicId &&
      item.cnpj === cnpj
    );
  }

  private companyAccessRequestWasRejected(metadata: Prisma.JsonValue) {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return false;
    }

    return (metadata as Record<string, unknown>).reviewStatus === "REJECTED";
  }

  private resolveClientIp(requestContext?: SessionRequestContext) {
    if (!requestContext) {
      return undefined;
    }

    const forwardedAddress = this.resolveHeaderValues(
      requestContext.forwardedFor,
    )[0];
    const address = forwardedAddress ?? requestContext.remoteAddress;

    return truncateForColumn(normalizeRemoteAddress(address), 64);
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
    }>,
  ): AuthCapabilities {
    return {
      canViewSensitive: profiles.some(
        (profile) => profile.accessProfile.canViewSensitive,
      ),
      canDownloadAttachments: profiles.some(
        (profile) => profile.accessProfile.canDownload,
      ),
      canSoftDeleteAttachment: profiles.some(
        (profile) => profile.accessProfile.canSoftDelete,
      ),
    };
  }

  private resolveSecurityContext(
    profiles: Array<unknown>,
    _capabilities: AuthCapabilities,
  ): AuthTokenPayload["securityContext"] {
    if (profiles.length > 0) {
      return "privileged";
    }

    return "authenticated";
  }

  private resolveAudienceGroupsFromProfiles(
    profiles: Array<{
      accessProfile: {
        code: AccessProfileCode;
      };
    }>,
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
      }),
    );
  }

  private resolveAudienceGroupsFromProfileKeys(
    profileKeys: string[],
  ): SensitiveAudienceGroup[] {
    return this.uniqueAudienceGroups(
      profileKeys.flatMap((profileKey) => {
        switch (profileKey) {
          case "admin":
          case "executive":
            return [SensitiveAudienceGroup.DIRECTOR];
          case "legal":
          case "hr":
          case "operations":
            return [SensitiveAudienceGroup.SUPERVISION];
          default:
            return [];
        }
      }),
    );
  }

  private uniqueAudienceGroups(
    groups: SensitiveAudienceGroup[],
  ): SensitiveAudienceGroup[] {
    return Array.from(new Set(groups));
  }

  private mapProfileCode(code: AccessProfileCode): string {
    // Os nomes mapeados aqui acabam virando contrato de interface e feature flag.
    // Se trocar vocabulario, alinhar front e documentacao no mesmo movimento.
    switch (code) {
      case AccessProfileCode.ADMIN:
        return "admin";
      case AccessProfileCode.EXECUTIVE:
        return "executive";
      case AccessProfileCode.LEGAL:
        return "legal";
      case AccessProfileCode.HR:
        return "hr";
      case AccessProfileCode.OPERATIONS:
        return "operations";
      default:
        return String(code).toLowerCase();
    }
  }

  private isLocalDevelopmentRequest(
    requestContext?: SessionRequestContext,
  ): boolean {
    if (!requestContext) {
      return false;
    }

    const originHosts = this.resolveHostnames(requestContext.origin);
    if (originHosts.length > 0 && !originHosts.every(isLocalHostname)) {
      return false;
    }

    const forwardedHosts = this.resolveHostnames(requestContext.forwardedHost);
    if (forwardedHosts.length > 0 && !forwardedHosts.every(isLocalHostname)) {
      return false;
    }

    const hostNames = this.resolveHostnames(requestContext.host);
    if (hostNames.length === 0 || !hostNames.every(isLocalHostname)) {
      return false;
    }

    const forwardedAddresses = this.resolveHeaderValues(
      requestContext.forwardedFor,
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
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }
}

function createUserPublicId(): string {
  return createPublicId("usr");
}

function createRefreshTokenValue(): string {
  return randomBytes(48).toString("base64url");
}

function hashRefreshToken(refreshToken: string): string {
  return createHash("sha256").update(refreshToken).digest("hex");
}

function hashSensitiveSessionCode(
  sessionPublicId: string,
  userSystemId: bigint,
  code: string,
): string {
  return createHash("sha256")
    .update(`${sessionPublicId}:${userSystemId}:${code}`)
    .digest("hex");
}

function maskEmail(value: string): string {
  const [name, domain] = value.split("@");
  if (!name || !domain) {
    return "email cadastrado";
  }

  const prefix = name.slice(0, 2);
  return `${prefix}${"*".repeat(Math.max(2, name.length - 2))}@${domain}`;
}

function hostnameFromHeaderValue(value: string): string | null {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    const parsedUrl = new URL(
      trimmedValue.includes("://") ? trimmedValue : `http://${trimmedValue}`,
    );

    return parsedUrl.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isLocalHostname(hostname: string): boolean {
  const normalizedHostname = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  return ["localhost", "127.0.0.1", "::1"].includes(normalizedHostname);
}

function isLocalRemoteAddress(remoteAddress?: string): boolean {
  if (!remoteAddress) {
    return false;
  }

  const normalizedAddress = remoteAddress
    .trim()
    .replace(/^::ffff:/, "")
    .toLowerCase();

  return ["localhost", "127.0.0.1", "::1"].includes(normalizedAddress);
}

function normalizeRemoteAddress(remoteAddress?: string): string | undefined {
  if (!remoteAddress) {
    return undefined;
  }

  return remoteAddress.trim().replace(/^::ffff:/, "");
}

function truncateForColumn(
  value: string | undefined,
  maxLength: number,
): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.length > maxLength ? value.slice(0, maxLength) : value;
}
