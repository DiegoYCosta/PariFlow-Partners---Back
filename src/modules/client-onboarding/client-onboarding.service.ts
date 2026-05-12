import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable
} from '@nestjs/common';
import {
  AccessProfileCode,
  ClientOnboardingCnpjStatus,
  ClientOnboardingContractType,
  ClientOnboardingRequestStatus,
  ClientOnboardingVerificationChannel,
  ClientOnboardingVerificationStatus,
  NotificationOutboxChannel,
  Prisma,
  TenantRootCompanyStatus
} from '@prisma/client';
import { createHash, randomInt } from 'node:crypto';
import { createPublicId } from '../../common/utils/public-id';
import { env } from '../../config/env';
import { PrismaService } from '../../infra/database/prisma.service';
import {
  CLIENT_ONBOARDING_REVIEW_EMAIL,
  CnpjOnboardingRegistryEntry,
  accessLevelQuotaPresets,
  cnpjOnboardingRegistry,
  companySizePresets,
  companyTypePresets,
  contractTypeForCnpjStatus
} from './client-onboarding.constants';
import {
  ClientOnboardingAccessQuotasDto,
  CreateClientOnboardingDto
} from './dto/create-client-onboarding.dto';
import { StartClientOnboardingVerificationDto } from './dto/start-client-onboarding-verification.dto';

type RegistryRecord = CnpjOnboardingRegistryEntry & {
  id?: bigint;
};

@Injectable()
export class ClientOnboardingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getOptions() {
    await this.ensureRegistrySeeded();

    return {
      companyTypes: companyTypePresets,
      companySizes: companySizePresets,
      accessLevels: accessLevelQuotaPresets,
      verificationChannels: [
        {
          value: ClientOnboardingVerificationChannel.EMAIL,
          label: 'E-mail cadastrado'
        },
        {
          value: ClientOnboardingVerificationChannel.PHONE,
          label: 'Telefone cadastrado'
        }
      ],
      reviewEmail: CLIENT_ONBOARDING_REVIEW_EMAIL
    };
  }

  async checkCnpj(cnpj: string) {
    await this.ensureRegistrySeeded();

    return this.mapCnpjStatus(
      await this.resolveRegistryEntry(this.normalizeCnpj(cnpj))
    );
  }

  async startVerification(dto: StartClientOnboardingVerificationDto) {
    this.prisma.assertConfigured();
    await this.ensureRegistrySeeded();

    const cnpj = this.normalizeCnpj(dto.cnpj);
    const registry = await this.resolveRegistryEntry(cnpj);

    if (!registry.id || !this.canCreateRootCompany(registry.status)) {
      throw new BadRequestException(
        'CNPJ nao esta liberado para verificacao automatica.'
      );
    }

    const target = this.normalizedVerificationTarget(dto.channel, dto.target);
    if (!this.targetMatchesRegistry(dto.channel, target, registry)) {
      throw new BadRequestException(
        'O canal informado nao confere com o contato comercial vinculado ao CNPJ.'
      );
    }

    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const channel = dto.channel;

    const challenge = await this.prisma.clientOnboardingVerificationChallenge.create({
      data: {
        publicId: createPublicId('ver'),
        cnpjRegistryId: registry.id,
        channel,
        target,
        codeHash: this.hashVerificationCode(cnpj, target, code),
        expiresAt
      }
    });

    await this.prisma.notificationOutbox.create({
      data: {
        publicId: createPublicId('not'),
        channel:
          channel === ClientOnboardingVerificationChannel.EMAIL
            ? NotificationOutboxChannel.EMAIL
            : NotificationOutboxChannel.SMS,
        target,
        subject: 'Codigo de verificacao PariFlow Partners',
        message: `Codigo de verificacao PariFlow Partners: ${code}. Ele expira em 10 minutos.`,
        metadataJson: {
          source: 'client_onboarding',
          cnpj,
          challengePublicId: challenge.publicId
        } as Prisma.InputJsonValue
      }
    });

    return {
      challengePublicId: challenge.publicId,
      expiresAt: challenge.expiresAt,
      channel,
      targetMasked:
        channel === ClientOnboardingVerificationChannel.EMAIL
          ? maskEmail(target)
          : maskPhone(target),
      deliveryQueued: true,
      devCode: env.NODE_ENV === 'production' ? undefined : code
    };
  }

  async create(dto: CreateClientOnboardingDto) {
    this.prisma.assertConfigured();

    const cnpj = this.normalizeCnpj(dto.cnpj);
    await this.ensureRegistrySeeded();
    const registry = await this.resolveRegistryEntry(cnpj);
    const cnpjStatus = registry.status;
    const contractType = contractTypeForCnpjStatus(cnpjStatus);
    const canCreateRootCompany = this.canCreateRootCompany(cnpjStatus);
    const verification = await this.resolveVerification(dto, registry);
    const accessLevelQuotas = this.normalizeAccessLevelQuotas(
      dto.accessLevelQuotas
    );

    if (!dto.primaryContactEmail && !dto.primaryContactPhone) {
      throw new BadRequestException(
        'Informe ao menos e-mail ou telefone do contato principal.'
      );
    }

    if (
      dto.verificationAccepted &&
      dto.verificationChannel === ClientOnboardingVerificationChannel.NONE
    ) {
      throw new BadRequestException(
        'Escolha e-mail ou telefone para validar em duas etapas.'
      );
    }

    const existingRootCompany = await this.prisma.tenantRootCompany.findUnique({
      where: { cnpj }
    });

    if (existingRootCompany) {
      throw new ConflictException(
        'Ja existe empresa raiz cadastrada ou em validacao para este CNPJ.'
      );
    }

    const released =
      canCreateRootCompany && verification.verificationMatchedRegistry;
    const requestStatus = this.resolveRequestStatus(cnpjStatus, released);
    const rootStatus = this.resolveRootStatus(contractType, released);
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const createdRequest = await tx.clientOnboardingRequest.create({
        data: {
          publicId: createPublicId('cor'),
          cnpj,
          tradeName: dto.tradeName,
          legalName: dto.legalName,
          stateRegistration: nullableText(dto.stateRegistration),
          municipalRegistration: nullableText(dto.municipalRegistration),
          companyType: dto.companyType,
          segment: dto.segment,
          primaryCnae: nullableText(dto.primaryCnae),
          companySize: dto.companySize,
          cnpjStatus,
          contractType,
          status: requestStatus,
          primaryContactName: dto.primaryContactName,
          primaryContactEmail: nullableText(dto.primaryContactEmail),
          primaryContactPhone: nullableText(dto.primaryContactPhone),
          accountQuotasJson: accessLevelQuotas as Prisma.InputJsonValue,
          verificationAccepted: dto.verificationAccepted,
          verificationChallengeId: verification.challengeId,
          verificationChannel: verification.channel,
          verificationTarget: verification.target,
          verificationMatchedRegistry: verification.verificationMatchedRegistry,
          reviewNotificationEmail:
            requestStatus === ClientOnboardingRequestStatus.PENDING_REVIEW
              ? CLIENT_ONBOARDING_REVIEW_EMAIL
              : null,
          releasedAt: released ? now : null
        }
      });

      if (!canCreateRootCompany) {
        await this.recordOnboardingAudit(
          tx,
          createdRequest.publicId,
          null,
          requestStatus
        );

        return { request: createdRequest, rootCompany: null };
      }

      const rootCompany = await tx.tenantRootCompany.create({
        data: {
          publicId: createPublicId('org'),
          tradeName: dto.tradeName,
          legalName: dto.legalName,
          cnpj,
          stateRegistration: nullableText(dto.stateRegistration),
          municipalRegistration: nullableText(dto.municipalRegistration),
          companyType: dto.companyType,
          segment: dto.segment,
          primaryCnae: nullableText(dto.primaryCnae),
          companySize: dto.companySize,
          contractType,
          status: rootStatus,
          isRootCompany: true,
          deletionLocked: true,
          primaryContactName: dto.primaryContactName,
          primaryContactEmail: nullableText(dto.primaryContactEmail),
          primaryContactPhone: nullableText(dto.primaryContactPhone),
          accountQuotasJson: accessLevelQuotas as Prisma.InputJsonValue,
          verifiedAt: released ? now : null
        }
      });

      const request = await tx.clientOnboardingRequest.update({
        where: { id: createdRequest.id },
        data: { tenantRootCompanyId: rootCompany.id }
      });

      await this.ensureFirstTenantAdmin(
        tx,
        rootCompany.id,
        dto,
        released
      );

      await this.recordOnboardingAudit(
        tx,
        request.publicId,
        rootCompany.id,
        requestStatus
      );

      return { request, rootCompany };
    });

    return {
      cnpjStatus: this.mapCnpjStatus(registry),
      request: this.mapRequest(result.request),
      tenantRootCompany: result.rootCompany
        ? this.mapRootCompany(result.rootCompany)
        : null,
      security: {
        immediateRelease: released,
        verificationAccepted: dto.verificationAccepted,
        verificationChannel: verification.channel,
        verificationMatchedRegistry: verification.verificationMatchedRegistry,
        reviewNotificationEmail:
          requestStatus === ClientOnboardingRequestStatus.PENDING_REVIEW
            ? CLIENT_ONBOARDING_REVIEW_EMAIL
            : null
      }
    };
  }

  private normalizeCnpj(value: string) {
    const cnpj = digitsOnly(value);

    if (!/^\d{14}$/.test(cnpj)) {
      throw new BadRequestException('CNPJ deve conter 14 digitos.');
    }

    return cnpj;
  }

  private async ensureRegistrySeeded() {
    this.prisma.assertConfigured();

    await this.prisma.clientOnboardingCnpjRegistry.createMany({
      data: cnpjOnboardingRegistry.map((entry) => ({
        publicId: createPublicId('cjr'),
        cnpj: entry.cnpj,
        status: entry.status,
        commercialContactName: entry.commercialContactName,
        commercialContactEmail: entry.commercialContactEmail ?? null,
        commercialContactPhone: entry.commercialContactPhone ?? null,
        note: entry.note
      })),
      skipDuplicates: true
    });
  }

  private async resolveRegistryEntry(cnpj: string): Promise<RegistryRecord> {
    const stored = await this.prisma.clientOnboardingCnpjRegistry.findUnique({
      where: { cnpj }
    });

    return stored
      ? {
          id: stored.id,
          cnpj: stored.cnpj,
          status: stored.status,
          commercialContactName: stored.commercialContactName,
          commercialContactEmail: stored.commercialContactEmail ?? undefined,
          commercialContactPhone: stored.commercialContactPhone ?? undefined,
          note: stored.note
        }
      : {
        cnpj,
        status: ClientOnboardingCnpjStatus.UNAVAILABLE,
        commercialContactName: 'Mesa Comercial',
        commercialContactEmail: CLIENT_ONBOARDING_REVIEW_EMAIL,
        note: 'CNPJ ainda nao consta na lista comercial liberada.'
      };
  }

  private async resolveVerification(
    dto: CreateClientOnboardingDto,
    registry: RegistryRecord
  ) {
    const channel = dto.verificationAccepted
      ? dto.verificationChannel
      : ClientOnboardingVerificationChannel.NONE;
    const target =
      channel === ClientOnboardingVerificationChannel.EMAIL
        ? this.normalizedVerificationTarget(channel, dto.primaryContactEmail)
        : channel === ClientOnboardingVerificationChannel.PHONE
          ? this.normalizedVerificationTarget(channel, dto.primaryContactPhone)
          : null;

    if (!dto.verificationAccepted) {
      return {
        channel,
        target,
        verificationMatchedRegistry: false,
        challengeId: null
      };
    }

    if (!target || !this.targetMatchesRegistry(channel, target, registry)) {
      return {
        channel,
        target,
        verificationMatchedRegistry: false,
        challengeId: null
      };
    }

    if (!dto.verificationChallengePublicId || !dto.verificationCode) {
      throw new BadRequestException(
        'Envie e confirme o codigo de verificacao para liberacao imediata.'
      );
    }

    const challenge = await this.prisma.clientOnboardingVerificationChallenge.findFirst({
      where: {
        publicId: dto.verificationChallengePublicId,
        cnpjRegistry: { cnpj: registry.cnpj },
        channel,
        target
      }
    });

    if (!challenge) {
      throw new BadRequestException('Codigo de verificacao nao encontrado.');
    }

    if (challenge.status !== ClientOnboardingVerificationStatus.PENDING) {
      throw new BadRequestException('Codigo de verificacao ja foi utilizado ou expirou.');
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      await this.prisma.clientOnboardingVerificationChallenge.update({
        where: { id: challenge.id },
        data: { status: ClientOnboardingVerificationStatus.EXPIRED }
      });
      throw new BadRequestException('Codigo de verificacao expirado.');
    }

    const codeMatches =
      challenge.codeHash ===
      this.hashVerificationCode(registry.cnpj, target, dto.verificationCode);

    if (!codeMatches) {
      const attempts = challenge.attempts + 1;
      await this.prisma.clientOnboardingVerificationChallenge.update({
        where: { id: challenge.id },
        data: {
          attempts,
          status:
            attempts >= challenge.maxAttempts
              ? ClientOnboardingVerificationStatus.FAILED
              : ClientOnboardingVerificationStatus.PENDING
        }
      });
      throw new BadRequestException('Codigo de verificacao invalido.');
    }

    await this.prisma.clientOnboardingVerificationChallenge.update({
      where: { id: challenge.id },
      data: {
        status: ClientOnboardingVerificationStatus.VERIFIED,
        attempts: challenge.attempts + 1,
        verifiedAt: new Date()
      }
    });

    return {
      channel,
      target,
      verificationMatchedRegistry: true,
      challengeId: challenge.id
    };
  }

  private normalizeAccessLevelQuotas(
    quotas?: ClientOnboardingAccessQuotasDto
  ): Record<string, number> {
    const values = quotas as Record<string, unknown> | undefined;

    return Object.fromEntries(
      accessLevelQuotaPresets.map((preset) => {
        const rawValue = values?.[preset.key];
        const numericValue =
          typeof rawValue === 'number' && Number.isFinite(rawValue)
            ? Math.trunc(rawValue)
            : preset.defaultQuota;

        return [preset.key, Math.min(999, Math.max(0, numericValue))];
      })
    );
  }

  private canCreateRootCompany(status: ClientOnboardingCnpjStatus) {
    return (
      status === ClientOnboardingCnpjStatus.AVAILABLE ||
      status === ClientOnboardingCnpjStatus.AVAILABLE_FOR_TEST
    );
  }

  private resolveRequestStatus(
    cnpjStatus: ClientOnboardingCnpjStatus,
    released: boolean
  ) {
    if (!this.canCreateRootCompany(cnpjStatus)) {
      return ClientOnboardingRequestStatus.UNAVAILABLE;
    }

    return released
      ? ClientOnboardingRequestStatus.RELEASED
      : ClientOnboardingRequestStatus.PENDING_REVIEW;
  }

  private resolveRootStatus(
    contractType: ClientOnboardingContractType,
    released: boolean
  ) {
    if (!released) {
      return TenantRootCompanyStatus.PENDING_REVIEW;
    }

    return contractType === ClientOnboardingContractType.DEMO_ACCESS
      ? TenantRootCompanyStatus.DEMO
      : TenantRootCompanyStatus.ACTIVE;
  }

  private mapCnpjStatus(registry: CnpjOnboardingRegistryEntry) {
    const contractType = contractTypeForCnpjStatus(registry.status);

    return {
      cnpj: registry.cnpj,
      availabilityStatus: registry.status,
      availabilityLabel: this.cnpjStatusLabel(registry.status),
      contractType,
      contractTypeLabel: this.contractTypeLabel(contractType),
      canSubmit: this.canCreateRootCompany(registry.status),
      canReleaseImmediately: this.canCreateRootCompany(registry.status),
      message: registry.note,
      commercialContact: {
        name: registry.commercialContactName,
        emailMasked: maskEmail(registry.commercialContactEmail),
        phoneMasked: maskPhone(registry.commercialContactPhone)
      }
    };
  }

  private async recordOnboardingAudit(
    tx: Prisma.TransactionClient,
    requestPublicId: string,
    tenantRootCompanyId: bigint | null,
    status: ClientOnboardingRequestStatus
  ) {
    await tx.auditLog.create({
      data: {
        publicId: createPublicId('aud'),
        tenantRootCompanyId,
        entityName: 'ClientOnboardingRequest',
        entityPublicId: requestPublicId,
        action: 'PUBLIC_CLIENT_ONBOARDING',
        description: `Solicitacao publica de cliente registrada com status ${status}.`
      }
    });
  }

  private async ensureFirstTenantAdmin(
    tx: Prisma.TransactionClient,
    tenantRootCompanyId: bigint,
    dto: CreateClientOnboardingDto,
    released: boolean
  ) {
    const email = normalizeEmail(dto.primaryContactEmail);
    if (!email) {
      return;
    }

    const user = await tx.userSystem.upsert({
      where: { email },
      update: {
        tenantRootCompanyId,
        name: dto.primaryContactName,
        status: released ? 'ACTIVE' : 'INACTIVE',
        mfaEnabled: true
      },
      create: {
        publicId: createPublicId('usr'),
        tenantRootCompanyId,
        name: dto.primaryContactName,
        email,
        status: released ? 'ACTIVE' : 'INACTIVE',
        mfaEnabled: true
      }
    });

    const adminProfile = await tx.accessProfile.upsert({
      where: { code: AccessProfileCode.ADMIN },
      update: {},
      create: {
        publicId: 'prf_admin_base',
        code: AccessProfileCode.ADMIN,
        name: 'Administrador',
        description: 'Acesso total ao sistema e aos modulos administrativos.',
        canViewSensitive: true,
        canDownload: true,
        canSoftDelete: true
      }
    });

    await tx.userAccessProfile.upsert({
      where: {
        userSystemId_accessProfileId: {
          userSystemId: user.id,
          accessProfileId: adminProfile.id
        }
      },
      update: {},
      create: {
        userSystemId: user.id,
        accessProfileId: adminProfile.id
      }
    });
  }

  private normalizedVerificationTarget(
    channel: ClientOnboardingVerificationChannel,
    target?: string | null
  ) {
    return channel === ClientOnboardingVerificationChannel.EMAIL
      ? normalizeEmail(target)
      : normalizePhone(target);
  }

  private targetMatchesRegistry(
    channel: ClientOnboardingVerificationChannel,
    target: string | null,
    registry: RegistryRecord
  ) {
    if (!target) {
      return false;
    }

    return channel === ClientOnboardingVerificationChannel.EMAIL
      ? target === normalizeEmail(registry.commercialContactEmail)
      : target === normalizePhone(registry.commercialContactPhone);
  }

  private hashVerificationCode(cnpj: string, target: string, code: string) {
    return createHash('sha256')
      .update(`${cnpj}:${target}:${code}:${env.JWT_ACCESS_SECRET}`)
      .digest('hex');
  }

  private mapRequest(item: {
    publicId: string;
    cnpj: string;
    status: ClientOnboardingRequestStatus;
    contractType: ClientOnboardingContractType;
    reviewNotificationEmail: string | null;
    submittedAt: Date;
    releasedAt: Date | null;
  }) {
    return {
      publicId: item.publicId,
      cnpj: item.cnpj,
      status: item.status,
      statusLabel: this.requestStatusLabel(item.status),
      contractType: item.contractType,
      contractTypeLabel: this.contractTypeLabel(item.contractType),
      reviewNotificationEmail: item.reviewNotificationEmail,
      submittedAt: item.submittedAt,
      releasedAt: item.releasedAt
    };
  }

  private mapRootCompany(item: {
    publicId: string;
    tradeName: string;
    legalName: string;
    cnpj: string;
    status: TenantRootCompanyStatus;
    contractType: ClientOnboardingContractType;
    isRootCompany: boolean;
    deletionLocked: boolean;
    verifiedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      publicId: item.publicId,
      tradeName: item.tradeName,
      legalName: item.legalName,
      cnpj: item.cnpj,
      status: item.status,
      statusLabel: this.rootStatusLabel(item.status),
      contractType: item.contractType,
      contractTypeLabel: this.contractTypeLabel(item.contractType),
      isRootCompany: item.isRootCompany,
      deletionLocked: item.deletionLocked,
      verifiedAt: item.verifiedAt,
      createdAt: item.createdAt
    };
  }

  private cnpjStatusLabel(status: ClientOnboardingCnpjStatus) {
    switch (status) {
      case ClientOnboardingCnpjStatus.AVAILABLE:
        return 'Disponivel';
      case ClientOnboardingCnpjStatus.AVAILABLE_FOR_TEST:
        return 'Disponivel para teste';
      case ClientOnboardingCnpjStatus.IN_USE:
        return 'Ja em uso';
      case ClientOnboardingCnpjStatus.UNAVAILABLE:
      default:
        return 'Cliente indisponivel';
    }
  }

  private contractTypeLabel(type: ClientOnboardingContractType) {
    switch (type) {
      case ClientOnboardingContractType.ACTIVE_CLIENT:
        return 'Cliente ativo';
      case ClientOnboardingContractType.DEMO_ACCESS:
        return 'Acesso demonstracao';
      case ClientOnboardingContractType.UNAVAILABLE:
      default:
        return 'Cliente indisponivel';
    }
  }

  private requestStatusLabel(status: ClientOnboardingRequestStatus) {
    switch (status) {
      case ClientOnboardingRequestStatus.RELEASED:
        return 'Liberado';
      case ClientOnboardingRequestStatus.PENDING_REVIEW:
        return 'Aguardando analise';
      case ClientOnboardingRequestStatus.PENDING_VERIFICATION:
        return 'Aguardando verificacao';
      case ClientOnboardingRequestStatus.REJECTED:
        return 'Negado';
      case ClientOnboardingRequestStatus.UNAVAILABLE:
      default:
        return 'Indisponivel';
    }
  }

  private rootStatusLabel(status: TenantRootCompanyStatus) {
    switch (status) {
      case TenantRootCompanyStatus.ACTIVE:
        return 'Ativa';
      case TenantRootCompanyStatus.DEMO:
        return 'Demonstracao';
      case TenantRootCompanyStatus.PENDING_REVIEW:
        return 'Aguardando analise';
      case TenantRootCompanyStatus.PENDING_VERIFICATION:
        return 'Aguardando verificacao';
      case TenantRootCompanyStatus.UNAVAILABLE:
      default:
        return 'Indisponivel';
    }
  }
}

function nullableText(value?: string | null) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function digitsOnly(value?: string | null) {
  return value?.replace(/\D/g, '') ?? '';
}

function normalizeEmail(value?: string | null) {
  return nullableText(value)?.toLowerCase() ?? '';
}

function normalizePhone(value?: string | null) {
  return digitsOnly(value);
}

function maskEmail(value?: string | null) {
  const normalized = normalizeEmail(value);

  if (!normalized.includes('@')) {
    return null;
  }

  const [name, domain] = normalized.split('@');
  const visible = name.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(2, name.length - 2))}@${domain}`;
}

function maskPhone(value?: string | null) {
  const digits = normalizePhone(value);

  if (digits.length < 4) {
    return null;
  }

  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}
