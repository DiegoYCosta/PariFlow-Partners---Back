import {
  Attachment,
  AttachmentStatus,
  Prisma,
  SensitiveAudienceGroup
} from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { createPublicId } from '../../common/utils/public-id';
import { rethrowPrismaError } from '../../common/utils/prisma-error';
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

@Injectable()
export class AttachmentsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createSubmission(dto: CreateAttachmentSubmissionDto) {
    this.prisma.assertConfigured();

    const [occurrenceId, ownerUserId, allowedUserIds] = await Promise.all([
      this.resolveOccurrenceId(dto.occurrencePublicId),
      this.resolveOwnerUserId(dto.ownerUserPublicId),
      this.resolveAudienceUserIds(dto.allowedUserPublicIds)
    ]);

    try {
      const item = await this.prisma.attachment.create({
        data: {
          publicId: createPublicId('anx'),
          occurrenceId,
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

    const [occurrenceId, actorUserId, ownerUserId, allowedUserIds] =
      await Promise.all([
        this.resolveOccurrenceId(dto.occurrencePublicId),
        this.resolveAuthenticatedUserId(actor.sub),
        this.resolveOwnerUserId(dto.ownerUserPublicId),
        this.resolveAudienceUserIds(dto.allowedUserPublicIds)
      ]);

    try {
      const item = await this.prisma.attachment.create({
        data: {
          publicId: createPublicId('anx'),
          occurrenceId,
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

    const targetWhere = await this.buildListTargetWhere(query);

    try {
      const items = await this.prisma.attachment.findMany({
        where: {
          ...targetWhere,
          status: AttachmentStatus.ACTIVE,
          classification: query.classification,
          AND: [this.buildVisibilityWhere(actor)]
        },
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
        where: {
          publicId,
          status: AttachmentStatus.ACTIVE,
          AND: [this.buildVisibilityWhere(actor)]
        },
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

    const item = await this.ensureActiveAttachmentWithRelations(publicId);

    if (!this.canManageAttachment(item, actor)) {
      throw new ForbiddenException(
        'Somente a autoria autenticada ou contexto privilegiado auditavel pode gerir este anexo.'
      );
    }

    const [ownerUserId, allowedUserIds] = await Promise.all([
      dto.ownerUserPublicId
        ? this.resolveOwnerUserId(dto.ownerUserPublicId)
        : Promise.resolve<bigint | undefined>(undefined),
      dto.allowedUserPublicIds
        ? this.resolveAudienceUserIds(dto.allowedUserPublicIds)
        : Promise.resolve<bigint[] | undefined>(undefined)
    ]);

    try {
      const updated = await this.prisma.attachment.update({
        where: { publicId },
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

    const item = await this.ensureActiveAttachmentWithRelations(publicId);

    if (!this.canManageAttachment(item, actor)) {
      throw new ForbiddenException(
        'Somente a autoria autenticada ou contexto privilegiado auditavel pode remover este anexo.'
      );
    }

    try {
      const removed = await this.prisma.attachment.update({
        where: { publicId },
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

  private async buildListTargetWhere(
    query: ListAttachmentsQueryDto
  ): Promise<Prisma.AttachmentWhereInput> {
    if (!query.occurrencePublicId && !query.personPublicId) {
      throw new BadRequestException(
        'Informe occurrencePublicId ou personPublicId para listar anexos.'
      );
    }

    const where: Prisma.AttachmentWhereInput = {};

    if (query.occurrencePublicId) {
      where.occurrenceId = await this.resolveOccurrenceId(
        query.occurrencePublicId
      );
    }

    if (query.personPublicId) {
      where.occurrence = {
        personId: await this.resolvePersonId(query.personPublicId)
      };
    }

    return where;
  }

  private async resolveOccurrenceId(publicId: string): Promise<bigint> {
    const occurrence = await this.prisma.occurrence.findUnique({
      where: { publicId },
      select: { id: true }
    });

    if (!occurrence) {
      throw new NotFoundException('Ocorrencia alvo do anexo nao foi encontrada.');
    }

    return occurrence.id;
  }

  private async resolvePersonId(publicId: string): Promise<bigint> {
    const person = await this.prisma.person.findUnique({
      where: { publicId },
      select: { id: true }
    });

    if (!person) {
      throw new NotFoundException('Pessoa alvo dos anexos nao foi encontrada.');
    }

    return person.id;
  }

  private async ensureActiveAttachmentWithRelations(
    publicId: string
  ): Promise<AttachmentWithRelations> {
    const item = await this.prisma.attachment.findFirst({
      where: {
        publicId,
        status: AttachmentStatus.ACTIVE
      },
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

  private async resolveOwnerUserId(userPublicId: string): Promise<bigint> {
    const user = await this.prisma.userSystem.findUnique({
      where: { publicId: userPublicId },
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

  private async resolveAudienceUserIds(
    userPublicIds?: string[]
  ): Promise<bigint[]> {
    const normalizedPublicIds = Array.from(
      new Set((userPublicIds ?? []).map((item) => item.trim()))
    );

    if (normalizedPublicIds.length === 0) {
      return [];
    }

    const users = await this.prisma.userSystem.findMany({
      where: {
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
