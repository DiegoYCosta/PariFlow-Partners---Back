import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import {
  EntityTag,
  EntityTagStatus,
  EntityTagTargetType,
  Prisma,
  SensitiveAudienceGroup
} from '@prisma/client';
import { createPublicId } from '../../common/utils/public-id';
import { rethrowPrismaError } from '../../common/utils/prisma-error';
import { PrismaService } from '../../infra/database/prisma.service';
import { AuthTokenPayload } from '../auth/interfaces/auth-token-payload.interface';
import { CreateEntityTagSubmissionDto } from './dto/create-entity-tag-submission.dto';
import { ListEntityTagsQueryDto } from './dto/list-entity-tags-query.dto';
import { UpdateEntityTagDto } from './dto/update-entity-tag.dto';

type EntityTagWithRelations = Prisma.EntityTagGetPayload<{
  include: {
    person: true;
    providerCompany: true;
    ownerUserSystem: true;
    createdByUserSystem: true;
    removedByUserSystem: true;
    audienceGroups: true;
    audienceUsers: {
      include: {
        userSystem: true;
      };
    };
  };
}>;

@Injectable()
export class EntityTagsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createSubmission(dto: CreateEntityTagSubmissionDto) {
    this.prisma.assertConfigured();

    const [target, ownerUserId, allowedUserIds] = await Promise.all([
      this.resolveTarget(dto.targetType, dto.targetPublicId),
      this.resolveOwnerUserId(dto.ownerUserPublicId),
      this.resolveAudienceUserIds(dto.allowedUserPublicIds)
    ]);

    try {
      const item = await this.prisma.entityTag.create({
        data: {
          publicId: createPublicId('tag'),
          targetType: dto.targetType,
          personId: target.personId,
          providerCompanyId: target.providerCompanyId,
          classification: dto.classification,
          label: dto.label,
          content: dto.content,
          color: this.normalizeColor(dto.color),
          sortOrder: dto.sortOrder,
          isAnonymousSubmission: true,
          ownerUserSystemId: ownerUserId,
          status: EntityTagStatus.ACTIVE,
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
        include: this.entityTagInclude
      });

      return this.mapEntityTag(item);
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async createInternal(
    dto: CreateEntityTagSubmissionDto,
    actor: AuthTokenPayload
  ) {
    this.prisma.assertConfigured();

    const [target, actorUserId, ownerUserId, allowedUserIds] = await Promise.all([
      this.resolveTarget(dto.targetType, dto.targetPublicId),
      this.resolveAuthenticatedUserId(actor.sub),
      this.resolveOwnerUserId(dto.ownerUserPublicId),
      this.resolveAudienceUserIds(dto.allowedUserPublicIds)
    ]);

    try {
      const item = await this.prisma.entityTag.create({
        data: {
          publicId: createPublicId('tag'),
          targetType: dto.targetType,
          personId: target.personId,
          providerCompanyId: target.providerCompanyId,
          classification: dto.classification,
          label: dto.label,
          content: dto.content,
          color: this.normalizeColor(dto.color),
          sortOrder: dto.sortOrder,
          isAnonymousSubmission: false,
          ownerUserSystemId: ownerUserId,
          createdByUserSystemId: actorUserId,
          status: EntityTagStatus.ACTIVE,
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
        include: this.entityTagInclude
      });

      return this.mapEntityTag(item, actor);
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async list(query: ListEntityTagsQueryDto, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    const target = await this.resolveTarget(query.targetType, query.targetPublicId);

    try {
      const items = await this.prisma.entityTag.findMany({
        where: {
          status: EntityTagStatus.ACTIVE,
          personId: target.personId,
          providerCompanyId: target.providerCompanyId,
          classification: query.classification,
          AND: [this.buildVisibilityWhere(actor)]
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: this.entityTagInclude
      });

      return {
        items: items.map((item) => this.mapEntityTag(item, actor))
      };
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async findOne(publicId: string, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    try {
      const item = await this.prisma.entityTag.findFirst({
        where: {
          publicId,
          status: EntityTagStatus.ACTIVE,
          AND: [this.buildVisibilityWhere(actor)]
        },
        include: this.entityTagInclude
      });

      if (!item) {
        throw new NotFoundException('Tag de entidade nao encontrada.');
      }

      return this.mapEntityTag(item, actor);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Tag de entidade nao encontrada.'
      });
    }
  }

  async update(
    publicId: string,
    dto: UpdateEntityTagDto,
    actor: AuthTokenPayload
  ) {
    this.prisma.assertConfigured();

    const item = await this.ensureActiveTagWithRelations(publicId);

    if (!this.canManageTag(item, actor)) {
      throw new ForbiddenException(
        'Somente a autoria autenticada ou contexto privilegiado auditavel pode gerir esta tag.'
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
      const updated = await this.prisma.entityTag.update({
        where: { publicId },
        data: {
          ownerUserSystemId: ownerUserId,
          label: dto.label,
          content: dto.content,
          classification: dto.classification,
          color: dto.color ? this.normalizeColor(dto.color) : undefined,
          sortOrder: dto.sortOrder,
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
        include: this.entityTagInclude
      });

      return this.mapEntityTag(updated, actor);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Tag de entidade nao encontrada.'
      });
    }
  }

  async remove(publicId: string, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    const actorUserId = await this.resolveAuthenticatedUserId(actor.sub);
    const item = await this.ensureActiveTagWithRelations(publicId);

    if (!this.canManageTag(item, actor)) {
      throw new ForbiddenException(
        'Somente a autoria autenticada ou contexto privilegiado auditavel pode remover esta tag.'
      );
    }

    try {
      const removed = await this.prisma.entityTag.update({
        where: { publicId },
        data: {
          status: EntityTagStatus.REMOVED,
          removedAt: new Date(),
          removedByUserSystemId: actorUserId
        },
        include: this.entityTagInclude
      });

      return {
        publicId: removed.publicId,
        status: removed.status,
        removedAt: removed.removedAt,
        removedBy: removed.removedByUserSystem
          ? {
              publicId: removed.removedByUserSystem.publicId,
              name: removed.removedByUserSystem.name
            }
          : null
      };
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Tag de entidade nao encontrada.'
      });
    }
  }

  private buildVisibilityWhere(actor: AuthTokenPayload): Prisma.EntityTagWhereInput {
    const orWhere: Prisma.EntityTagWhereInput[] = [
      {
        ownerUserSystem: {
          publicId: actor.sub
        }
      },
      {
        createdByUserSystem: {
          publicId: actor.sub
        }
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
      orWhere.push({
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
      OR: orWhere
    };
  }

  private async resolveTarget(
    targetType: EntityTagTargetType,
    targetPublicId: string
  ): Promise<{
    personId: bigint | null;
    providerCompanyId: bigint | null;
  }> {
    switch (targetType) {
      case EntityTagTargetType.PERSON: {
        const person = await this.prisma.person.findUnique({
          where: { publicId: targetPublicId },
          select: { id: true }
        });

        if (!person) {
          throw new NotFoundException('Pessoa alvo da tag nao foi encontrada.');
        }

        return {
          personId: person.id,
          providerCompanyId: null
        };
      }
      case EntityTagTargetType.PROVIDER_COMPANY: {
        const providerCompany = await this.prisma.providerCompany.findUnique({
          where: { publicId: targetPublicId },
          select: { id: true }
        });

        if (!providerCompany) {
          throw new NotFoundException(
            'Empresa prestadora alvo da tag nao foi encontrada.'
          );
        }

        return {
          personId: null,
          providerCompanyId: providerCompany.id
        };
      }
      default:
        throw new NotFoundException('Tipo de alvo da tag nao suportado.');
    }
  }

  private async ensureActiveTagWithRelations(
    publicId: string
  ): Promise<EntityTagWithRelations> {
    const item = await this.prisma.entityTag.findFirst({
      where: {
        publicId,
        status: EntityTagStatus.ACTIVE
      },
      include: this.entityTagInclude
    });

    if (!item) {
      throw new NotFoundException('Tag de entidade nao encontrada.');
    }

    return item;
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

  private async resolveOwnerUserId(userPublicId: string): Promise<bigint> {
    const user = await this.prisma.userSystem.findUnique({
      where: { publicId: userPublicId },
      select: { id: true }
    });

    if (!user) {
      throw new NotFoundException(
        'A autoria autenticada indicada para o conteudo nao foi encontrada.'
      );
    }

    return user.id;
  }

  private async resolveAudienceUserIds(
    userPublicIds?: string[]
  ): Promise<bigint[]> {
    const normalized = Array.from(
      new Set(
        (userPublicIds ?? [])
          .map((publicId) => publicId.trim())
          .filter((publicId) => publicId.length > 0)
      )
    );

    if (normalized.length === 0) {
      return [];
    }

    const users = await this.prisma.userSystem.findMany({
      where: {
        publicId: {
          in: normalized
        }
      },
      select: {
        id: true,
        publicId: true
      }
    });

    if (users.length !== normalized.length) {
      const found = new Set(users.map((user) => user.publicId));
      const missing = normalized.filter((publicId) => !found.has(publicId));
      throw new NotFoundException(
        `Colaborador(es) do compartilhamento nao encontrado(s): ${missing.join(', ')}`
      );
    }

    return users.map((user) => user.id);
  }

  private normalizeGroupKeys(
    groupKeys?: SensitiveAudienceGroup[]
  ): SensitiveAudienceGroup[] {
    return Array.from(new Set(groupKeys ?? []));
  }

  private canReadTag(item: EntityTagWithRelations, actor: AuthTokenPayload): boolean {
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

  private canManageTag(item: EntityTagWithRelations, actor: AuthTokenPayload): boolean {
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

  private normalizeColor(color?: string): string {
    return (color ?? '#536A75').toUpperCase();
  }

  private mapEntityTag(item: EntityTagWithRelations, actor?: AuthTokenPayload) {
    const canView = actor ? this.canReadTag(item, actor) : false;
    const canManage = actor ? this.canManageTag(item, actor) : false;

    return {
      publicId: item.publicId,
      targetType: item.targetType,
      targetPublicId:
        item.person?.publicId ?? item.providerCompany?.publicId ?? null,
      ownerUserPublicId:
        item.ownerUserSystem?.publicId ?? item.createdByUserSystem?.publicId ?? null,
      classification: item.classification,
      status: item.status,
      label: item.label,
      content: item.content,
      color: item.color,
      sortOrder: item.sortOrder,
      isAnonymousSubmission: item.isAnonymousSubmission,
      allowedGroupKeys: item.audienceGroups.map((entry) => entry.groupKey),
      allowedUserPublicIds: item.audienceUsers.map(
        (entry) => entry.userSystem.publicId
      ),
      canView,
      canEdit: canManage,
      canDelete: canManage,
      canManage,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      removedAt: item.removedAt,
      createdBy: item.createdByUserSystem
        ? {
            publicId: item.createdByUserSystem.publicId,
            name: item.createdByUserSystem.name
          }
        : null,
      removedBy: item.removedByUserSystem
        ? {
            publicId: item.removedByUserSystem.publicId,
            name: item.removedByUserSystem.name
          }
        : null
    };
  }

  private get entityTagInclude() {
    return {
      person: true,
      providerCompany: true,
      ownerUserSystem: true,
      createdByUserSystem: true,
      removedByUserSystem: true,
      audienceGroups: true,
      audienceUsers: {
        include: {
          userSystem: true
        }
      }
    } satisfies Prisma.EntityTagInclude;
  }
}
