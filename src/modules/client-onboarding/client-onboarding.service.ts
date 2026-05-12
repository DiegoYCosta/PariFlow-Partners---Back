import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable
} from '@nestjs/common';
import {
  ClientOnboardingCnpjStatus,
  ClientOnboardingContractType,
  ClientOnboardingRequestStatus,
  ClientOnboardingVerificationChannel,
  Prisma,
  TenantRootCompanyStatus
} from '@prisma/client';
import { createPublicId } from '../../common/utils/public-id';
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

@Injectable()
export class ClientOnboardingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  getOptions() {
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

  checkCnpj(cnpj: string) {
    return this.mapCnpjStatus(this.resolveRegistryEntry(this.normalizeCnpj(cnpj)));
  }

  async create(dto: CreateClientOnboardingDto) {
    this.prisma.assertConfigured();

    const cnpj = this.normalizeCnpj(dto.cnpj);
    const registry = this.resolveRegistryEntry(cnpj);
    const cnpjStatus = registry.status;
    const contractType = contractTypeForCnpjStatus(cnpjStatus);
    const canCreateRootCompany = this.canCreateRootCompany(cnpjStatus);
    const verification = this.resolveVerification(dto, registry);
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

  private resolveRegistryEntry(cnpj: string): CnpjOnboardingRegistryEntry {
    return (
      cnpjOnboardingRegistry.find((entry) => entry.cnpj === cnpj) ?? {
        cnpj,
        status: ClientOnboardingCnpjStatus.UNAVAILABLE,
        commercialContactName: 'Mesa Comercial',
        commercialContactEmail: CLIENT_ONBOARDING_REVIEW_EMAIL,
        note: 'CNPJ ainda nao consta na lista comercial liberada.'
      }
    );
  }

  private resolveVerification(
    dto: CreateClientOnboardingDto,
    registry: CnpjOnboardingRegistryEntry
  ) {
    const channel = dto.verificationAccepted
      ? dto.verificationChannel
      : ClientOnboardingVerificationChannel.NONE;
    const target =
      channel === ClientOnboardingVerificationChannel.EMAIL
        ? nullableText(dto.primaryContactEmail)
        : channel === ClientOnboardingVerificationChannel.PHONE
          ? nullableText(dto.primaryContactPhone)
          : null;

    const verificationMatchedRegistry =
      dto.verificationAccepted &&
      ((channel === ClientOnboardingVerificationChannel.EMAIL &&
        normalizeEmail(dto.primaryContactEmail) ===
          normalizeEmail(registry.commercialContactEmail)) ||
        (channel === ClientOnboardingVerificationChannel.PHONE &&
          normalizePhone(dto.primaryContactPhone) ===
            normalizePhone(registry.commercialContactPhone)));

    return {
      channel,
      target,
      verificationMatchedRegistry
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
