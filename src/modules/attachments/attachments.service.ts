import {
  AttachmentClassification,
  AttachmentStatus,
  Prisma,
  SensitiveAudienceGroup,
  SensitiveSessionLevel,
  SensitiveSessionStatus
} from '@prisma/client';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { createPublicId } from '../../common/utils/public-id';
import { assertPublicSubmissionAllowed } from '../../common/utils/public-submission';
import { rethrowPrismaError } from '../../common/utils/prisma-error';
import { tenantWhere } from '../../common/tenant/tenant-scope';
import { env } from '../../config/env';
import { PrismaService } from '../../infra/database/prisma.service';
import { AuthTokenPayload } from '../auth/interfaces/auth-token-payload.interface';
import { CreateAttachmentSubmissionDto } from './dto/create-attachment-submission.dto';
import { ListAttachmentsQueryDto } from './dto/list-attachments-query.dto';
import { UpdateAttachmentDto } from './dto/update-attachment.dto';

type AttachmentWithRelations = Prisma.AttachmentGetPayload<{
  include: {
    occurrence: true;
    ownerUserSystem: true;
    createdByUserSystem: true;
    audienceGroups: true;
    audienceUsers: {
      include: {
        userSystem: true;
      };
    };
  };
}>;

type TargetReference = {
  id: bigint;
  tenantRootCompanyId: bigint | null;
};

type AttachmentAccessDisposition = 'view' | 'download';

type AttachmentAccessContext = {
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AttachmentsService {
  private readonly s3Client = new S3Client({ region: env.AWS_REGION });

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createSubmission(
    dto: CreateAttachmentSubmissionDto,
    publicSubmissionToken?: string
  ) {
    assertPublicSubmissionAllowed(publicSubmissionToken);
    this.prisma.assertConfigured();

    const [occurrence, ownerUserId, allowedUserIds] = await Promise.all([
      this.resolveOccurrenceReference(dto.occurrencePublicId),
      this.resolveOwnerUserId(dto.ownerUserPublicId),
      this.resolveAudienceUserIds(dto.allowedUserPublicIds)
    ]);

    try {
      const item = await this.prisma.attachment.create({
        data: {
          publicId: createPublicId('anx'),
          tenantRootCompanyId: occurrence.tenantRootCompanyId ?? undefined,
          occurrenceId: occurrence.id,
          ownerUserSystemId: ownerUserId,
          displayScope: dto.displayScope,
          classification: dto.classification,
          fileName: dto.fileName,
          mimeType: dto.mimeType,
          storagePath: dto.storagePath,
          externalLink: dto.externalLink,
          physicalLocation: dto.physicalLocation,
          visibleInExecutive: dto.visibleInExecutive,
          visibleInContext: dto.visibleInContext,
          requiresConfirmation: dto.requiresConfirmation,
          status: AttachmentStatus.ACTIVE,
          audienceGroups: dto.allowedGroupKeys?.length
            ? {
                create: this.normalizeGroupKeys(dto.allowedGroupKeys).map(
                  (groupKey) => ({ groupKey })
                )
              }
            : undefined,
          audienceUsers: allowedUserIds.length
            ? {
                create: allowedUserIds.map((userSystemId) => ({ userSystemId }))
              }
            : undefined
        },
        include: this.attachmentInclude
      });

      return this.mapAttachment(item);
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async createInternal(
    dto: CreateAttachmentSubmissionDto,
    actor: AuthTokenPayload
  ) {
    this.prisma.assertConfigured();

    const [occurrence, actorUserId, ownerUserId, allowedUserIds] =
      await Promise.all([
        this.resolveOccurrenceReference(dto.occurrencePublicId, actor),
        this.resolveAuthenticatedUserId(actor.sub),
        this.resolveOwnerUserId(dto.ownerUserPublicId, actor),
        this.resolveAudienceUserIds(dto.allowedUserPublicIds, actor)
      ]);

    try {
      const item = await this.prisma.attachment.create({
        data: {
          publicId: createPublicId('anx'),
          tenantRootCompanyId: occurrence.tenantRootCompanyId ?? undefined,
          occurrenceId: occurrence.id,
          ownerUserSystemId: ownerUserId,
          createdByUserSystemId: actorUserId,
          displayScope: dto.displayScope,
          classification: dto.classification,
          fileName: dto.fileName,
          mimeType: dto.mimeType,
          storagePath: dto.storagePath,
          externalLink: dto.externalLink,
          physicalLocation: dto.physicalLocation,
          visibleInExecutive: dto.visibleInExecutive,
          visibleInContext: dto.visibleInContext,
          requiresConfirmation: dto.requiresConfirmation,
          status: AttachmentStatus.ACTIVE,
          audienceGroups: dto.allowedGroupKeys?.length
            ? {
                create: this.normalizeGroupKeys(dto.allowedGroupKeys).map(
                  (groupKey) => ({ groupKey })
                )
              }
            : undefined,
          audienceUsers: allowedUserIds.length
            ? {
                create: allowedUserIds.map((userSystemId) => ({ userSystemId }))
              }
            : undefined
        },
        include: this.attachmentInclude
      });

      return this.mapAttachment(item, actor);
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async list(query: ListAttachmentsQueryDto, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    const targetWhere = await this.buildListTargetWhere(query, actor);

    try {
      const items = await this.prisma.attachment.findMany({
        where: tenantWhere(actor, {
          ...targetWhere,
          status: AttachmentStatus.ACTIVE,
          classification: query.classification,
          AND: [this.buildVisibilityWhere(actor)]
        }),
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        include: this.attachmentInclude
      });

      return {
        items: items.map((item) => this.mapAttachment(item, actor))
      };
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async findOne(publicId: string, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    try {
      const item = await this.prisma.attachment.findFirst({
        where: tenantWhere(actor, {
          publicId,
          status: AttachmentStatus.ACTIVE,
          AND: [this.buildVisibilityWhere(actor)]
        }),
        include: this.attachmentInclude
      });

      if (!item) {
        throw new NotFoundException('Anexo protegido nao encontrado.');
      }

      return this.mapAttachment(item, actor);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Anexo protegido nao encontrado.'
      });
    }
  }

  async update(
    publicId: string,
    dto: UpdateAttachmentDto,
    actor: AuthTokenPayload
  ) {
    this.prisma.assertConfigured();

    const item = await this.ensureActiveAttachmentWithRelations(publicId, actor);

    if (!this.canManageAttachment(item, actor)) {
      throw new ForbiddenException(
        'Somente a autoria autenticada ou contexto privilegiado auditavel pode gerir este anexo.'
      );
    }

    const [ownerUserId, allowedUserIds] = await Promise.all([
      dto.ownerUserPublicId
        ? this.resolveOwnerUserId(dto.ownerUserPublicId, actor)
        : Promise.resolve<bigint | undefined>(undefined),
      dto.allowedUserPublicIds
        ? this.resolveAudienceUserIds(dto.allowedUserPublicIds, actor)
        : Promise.resolve<bigint[] | undefined>(undefined)
    ]);

    try {
      const updated = await this.prisma.attachment.update({
        where: { id: item.id },
        data: {
          ownerUserSystemId: ownerUserId,
          displayScope: dto.displayScope,
          classification: dto.classification,
          fileName: dto.fileName,
          mimeType: dto.mimeType,
          storagePath: dto.storagePath,
          externalLink: dto.externalLink,
          physicalLocation: dto.physicalLocation,
          visibleInExecutive: dto.visibleInExecutive,
          visibleInContext: dto.visibleInContext,
          requiresConfirmation: dto.requiresConfirmation,
          audienceGroups:
            dto.allowedGroupKeys !== undefined
              ? {
                  deleteMany: {},
                  create: this.normalizeGroupKeys(dto.allowedGroupKeys).map(
                    (groupKey) => ({ groupKey })
                  )
                }
              : undefined,
          audienceUsers:
            allowedUserIds !== undefined
              ? {
                  deleteMany: {},
                  create: allowedUserIds.map((userSystemId) => ({ userSystemId }))
                }
              : undefined
        },
        include: this.attachmentInclude
      });

      return this.mapAttachment(updated, actor);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Anexo protegido nao encontrado.'
      });
    }
  }

  async remove(publicId: string, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    const item = await this.ensureActiveAttachmentWithRelations(publicId, actor);

    if (!this.canManageAttachment(item, actor)) {
      throw new ForbiddenException(
        'Somente a autoria autenticada ou contexto privilegiado auditavel pode remover este anexo.'
      );
    }

    try {
      const removed = await this.prisma.attachment.update({
        where: { id: item.id },
        data: {
          status: AttachmentStatus.DELETED,
          deletedAt: new Date()
        },
        include: this.attachmentInclude
      });

      return {
        publicId: removed.publicId,
        status: removed.status,
        deletedAt: removed.deletedAt
      };
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Anexo protegido nao encontrado.'
      });
    }
  }

  async createAccess(
    publicId: string,
    disposition: AttachmentAccessDisposition,
    actor: AuthTokenPayload,
    context: AttachmentAccessContext = {}
  ) {
    this.prisma.assertConfigured();

    const item = await this.ensureActiveAttachmentWithRelations(publicId, actor);
    if (!this.canReadAttachment(item, actor)) {
      throw new ForbiddenException('Usuario sem acesso ao anexo protegido.');
    }

    if (this.requiresSensitiveSession(item)) {
      await this.assertVerifiedSensitiveSession(actor, SensitiveSessionLevel.SENSITIVE);
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const object = this.resolvePrivateObject(item.storagePath);
    const signedUrl = object
      ? await getSignedUrl(
          this.s3Client,
          new GetObjectCommand({
            Bucket: object.bucket,
            Key: object.key,
            ResponseContentDisposition:
              disposition === 'download'
                ? `attachment; filename="${safeDownloadName(item.fileName)}"`
                : `inline; filename="${safeDownloadName(item.fileName)}"`
          }),
          { expiresIn: 5 * 60 }
        )
      : item.externalLink;

    await this.recordAttachmentAudit(item, actor, disposition, context);

    return {
      publicId: item.publicId,
      fileName: item.fileName,
      mimeType: item.mimeType,
      disposition,
      source: object ? 'S3_PRIVATE' : item.externalLink ? 'EXTERNAL_LINK' : 'METADATA_ONLY',
      signedUrl: signedUrl ?? null,
      expiresAt,
      requiresSensitiveSession: this.requiresSensitiveSession(item)
    };
  }

  private async buildListTargetWhere(
    query: ListAttachmentsQueryDto,
    actor: AuthTokenPayload
  ): Promise<Prisma.AttachmentWhereInput> {
    if (!query.occurrencePublicId && !query.personPublicId) {
      throw new BadRequestException(
        'Informe occurrencePublicId ou personPublicId para listar anexos.'
      );
    }

    const where: Prisma.AttachmentWhereInput = {};

    if (query.occurrencePublicId) {
      const occurrence = await this.resolveOccurrenceReference(
        query.occurrencePublicId,
        actor
      );
      where.occurrenceId = occurrence.id;
    }

    if (query.personPublicId) {
      where.occurrence = {
        personId: await this.resolvePersonId(query.personPublicId, actor)
      };
    }

    return where;
  }

  private async resolveOccurrenceReference(
    publicId: string,
    actor?: AuthTokenPayload
  ): Promise<TargetReference> {
    const occurrence = await this.prisma.occurrence.findFirst({
      where: actor ? tenantWhere(actor, { publicId }) : { publicId },
      select: { id: true, tenantRootCompanyId: true }
    });

    if (!occurrence) {
      throw new NotFoundException('Ocorrencia alvo do anexo nao foi encontrada.');
    }

    return occurrence;
  }

  private async resolvePersonId(
    publicId: string,
    actor: AuthTokenPayload
  ): Promise<bigint> {
    const person = await this.prisma.person.findFirst({
      where: tenantWhere(actor, { publicId }),
      select: { id: true }
    });

    if (!person) {
      throw new NotFoundException('Pessoa alvo dos anexos nao foi encontrada.');
    }

    return person.id;
  }

  private async ensureActiveAttachmentWithRelations(
    publicId: string,
    actor: AuthTokenPayload
  ): Promise<AttachmentWithRelations> {
    const item = await this.prisma.attachment.findFirst({
      where: tenantWhere(actor, {
        publicId,
        status: AttachmentStatus.ACTIVE
      }),
      include: this.attachmentInclude
    });

    if (!item) {
      throw new NotFoundException('Anexo protegido nao encontrado.');
    }

    return item;
  }

  private buildVisibilityWhere(
    actor: AuthTokenPayload
  ): Prisma.AttachmentWhereInput {
    const visibility: Prisma.AttachmentWhereInput[] = [
      {
        ownerUserSystem: {
          publicId: actor.sub
        }
      },
      {
        AND: [
          { ownerUserSystemId: null },
          {
            createdByUserSystem: {
              publicId: actor.sub
            }
          }
        ]
      },
      {
        audienceUsers: {
          some: {
            userSystem: {
              publicId: actor.sub
            }
          }
        }
      }
    ];

    if (actor.audienceGroups.length > 0) {
      visibility.push({
        audienceGroups: {
          some: {
            groupKey: {
              in: actor.audienceGroups
            }
          }
        }
      });
    }

    return {
      OR: visibility
    };
  }

  private async resolveOwnerUserId(
    userPublicId: string,
    actor?: AuthTokenPayload
  ): Promise<bigint> {
    const user = await this.prisma.userSystem.findFirst({
      where: actor ? tenantWhere(actor, { publicId: userPublicId }) : { publicId: userPublicId },
      select: { id: true }
    });

    if (!user) {
      throw new NotFoundException(
        'Usuario dono do anexo nao foi encontrado.'
      );
    }

    return user.id;
  }

  private async resolveAuthenticatedUserId(userPublicId: string): Promise<bigint> {
    const user = await this.prisma.userSystem.findUnique({
      where: { publicId: userPublicId },
      select: { id: true }
    });

    if (!user) {
      throw new UnauthorizedException(
        'Usuario autenticado nao foi encontrado para registrar a operacao.'
      );
    }

    return user.id;
  }

  private async assertVerifiedSensitiveSession(
    actor: AuthTokenPayload,
    minimumLevel: SensitiveSessionLevel
  ) {
    const user = await this.prisma.userSystem.findUnique({
      where: { publicId: actor.sub },
      select: { id: true }
    });

    if (!user) {
      throw new UnauthorizedException('Usuario autenticado nao encontrado.');
    }

    const allowedLevels =
      minimumLevel === SensitiveSessionLevel.CRITICAL
        ? [SensitiveSessionLevel.CRITICAL]
        : [SensitiveSessionLevel.SENSITIVE, SensitiveSessionLevel.CRITICAL];
    const session = await this.prisma.sensitiveSession.findFirst({
      where: {
        userSystemId: user.id,
        status: SensitiveSessionStatus.VERIFIED,
        level: { in: allowedLevels },
        expiresAt: { gt: new Date() }
      },
      orderBy: { expiresAt: 'desc' }
    });

    if (!session) {
      throw new ForbiddenException(
        'Sessao sensivel verificada e obrigatoria para acessar este anexo.'
      );
    }
  }

  private async resolveAudienceUserIds(
    userPublicIds?: string[],
    actor?: AuthTokenPayload
  ): Promise<bigint[]> {
    const normalizedPublicIds = Array.from(
      new Set((userPublicIds ?? []).map((item) => item.trim()))
    );

    if (normalizedPublicIds.length === 0) {
      return [];
    }

    const users = await this.prisma.userSystem.findMany({
      where: actor ? tenantWhere(actor, {
        publicId: {
          in: normalizedPublicIds
        }
      }) : {
        publicId: {
          in: normalizedPublicIds
        }
      },
      select: {
        id: true,
        publicId: true
      }
    });

    if (users.length !== normalizedPublicIds.length) {
      throw new NotFoundException(
        'Um ou mais usuarios permitidos para o anexo nao foram encontrados.'
      );
    }

    return users.map((user) => user.id);
  }

  private normalizeGroupKeys(
    groupKeys?: SensitiveAudienceGroup[]
  ): SensitiveAudienceGroup[] {
    return Array.from(new Set(groupKeys ?? []));
  }

  private canReadAttachment(
    item: AttachmentWithRelations,
    actor: AuthTokenPayload
  ): boolean {
    if (item.ownerUserSystem?.publicId === actor.sub) {
      return true;
    }

    if (
      item.ownerUserSystem == null &&
      item.createdByUserSystem?.publicId === actor.sub
    ) {
      return true;
    }

    if (
      item.audienceUsers.some(
        (entry) => entry.userSystem.publicId === actor.sub
      )
    ) {
      return true;
    }

    return item.audienceGroups.some((entry) =>
      actor.audienceGroups.includes(entry.groupKey)
    );
  }

  private canManageAttachment(
    item: AttachmentWithRelations,
    actor: AuthTokenPayload
  ): boolean {
    if (item.ownerUserSystem?.publicId === actor.sub) {
      return true;
    }

    if (
      item.ownerUserSystem == null &&
      item.createdByUserSystem?.publicId === actor.sub
    ) {
      return true;
    }

    return this.isPrivilegedActor(actor);
  }

  private isPrivilegedActor(actor: AuthTokenPayload): boolean {
    return actor.securityContext !== 'authenticated';
  }

  private requiresSensitiveSession(item: AttachmentWithRelations): boolean {
    return (
      item.classification === AttachmentClassification.SENSITIVE_ATTACHMENT ||
      item.requiresConfirmation
    );
  }

  private resolvePrivateObject(storagePath?: string | null):
    | { bucket: string; key: string }
    | undefined {
    const value = storagePath?.trim();
    if (!value) {
      return undefined;
    }

    if (value.startsWith('s3://')) {
      const withoutScheme = value.slice('s3://'.length);
      const slashIndex = withoutScheme.indexOf('/');
      if (slashIndex > 0) {
        return {
          bucket: withoutScheme.slice(0, slashIndex),
          key: withoutScheme.slice(slashIndex + 1)
        };
      }
    }

    if (!env.S3_BUCKET_PRIVATE) {
      return undefined;
    }

    return {
      bucket: env.S3_BUCKET_PRIVATE,
      key: value.replace(/^\/+/, '')
    };
  }

  private async recordAttachmentAudit(
    item: AttachmentWithRelations,
    actor: AuthTokenPayload,
    disposition: AttachmentAccessDisposition,
    context: AttachmentAccessContext
  ) {
    const userSystemId = await this.resolveAuthenticatedUserId(actor.sub);
    await this.prisma.auditLog.create({
      data: {
        publicId: createPublicId('aud'),
        tenantRootCompanyId: item.tenantRootCompanyId,
        userSystemId,
        entityName: 'Attachment',
        entityPublicId: item.publicId,
        action:
          disposition === 'download'
            ? 'ATTACHMENT_DOWNLOADED'
            : 'ATTACHMENT_VIEWED',
        description: `${disposition === 'download' ? 'Download' : 'Visualizacao'} auditavel do anexo ${item.fileName}.`,
        ipAddress: truncateForColumn(context.ipAddress, 64),
        device: truncateForColumn(context.userAgent, 255)
      }
    });
  }

  private mapAttachment(item: AttachmentWithRelations, actor?: AuthTokenPayload) {
    const canView = actor ? this.canReadAttachment(item, actor) : false;
    const canManage = actor ? this.canManageAttachment(item, actor) : false;

    return {
      publicId: item.publicId,
      occurrencePublicId: item.occurrence.publicId,
      ownerUserPublicId:
        item.ownerUserSystem?.publicId ?? item.createdByUserSystem?.publicId ?? null,
      displayScope: item.displayScope,
      classification: item.classification,
      fileName: item.fileName,
      mimeType: item.mimeType,
      storagePath: item.storagePath,
      externalLink: item.externalLink,
      physicalLocation: item.physicalLocation,
      visibleInExecutive: item.visibleInExecutive,
      visibleInContext: item.visibleInContext,
      requiresConfirmation: item.requiresConfirmation,
      version: item.version,
      status: item.status,
      allowedGroupKeys: item.audienceGroups.map((entry) => entry.groupKey),
      allowedUserPublicIds: item.audienceUsers.map(
        (entry) => entry.userSystem.publicId
      ),
      canView,
      canDownload: canView,
      canEdit: canManage,
      canDelete: canManage,
      canManage,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      deletedAt: item.deletedAt,
      createdBy: item.createdByUserSystem
        ? {
            publicId: item.createdByUserSystem.publicId,
            name: item.createdByUserSystem.name
          }
        : null
    };
  }

  private get attachmentInclude() {
    return {
      occurrence: true,
      ownerUserSystem: true,
      createdByUserSystem: true,
      audienceGroups: true,
      audienceUsers: {
        include: {
          userSystem: true
        }
      }
    } satisfies Prisma.AttachmentInclude;
  }
}

function safeDownloadName(value: string): string {
  return value.replace(/["\r\n]/g, '').trim() || 'anexo';
}

function truncateForColumn(
  value: string | undefined,
  maxLength: number
): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.length > maxLength ? value.slice(0, maxLength) : value;
}
