import {
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import {
  EntityTag,
  EntityTagStatus,
  EntityTagTargetType,
  Prisma
} from '@prisma/client';
import { createPublicId } from '../../common/utils/public-id';
import { rethrowPrismaError } from '../../common/utils/prisma-error';
import { PrismaService } from '../../infra/database/prisma.service';
import { CreateEntityTagSubmissionDto } from './dto/create-entity-tag-submission.dto';
import { ListEntityTagsQueryDto } from './dto/list-entity-tags-query.dto';
import { UpdateEntityTagDto } from './dto/update-entity-tag.dto';

type EntityTagWithRelations = Prisma.EntityTagGetPayload<{
  include: {
    person: true;
    providerCompany: true;
    createdByUserSystem: true;
    removedByUserSystem: true;
  };
}>;

@Injectable()
export class EntityTagsService {
  constructor(private readonly prisma: PrismaService) {}

  async createSubmission(dto: CreateEntityTagSubmissionDto) {
    this.prisma.assertConfigured();

    const target = await this.resolveTarget(dto.targetType, dto.targetPublicId);

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
          status: EntityTagStatus.ACTIVE
        },
        include: this.entityTagInclude
      });

      return this.mapEntityTag(item);
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async createInternal(dto: CreateEntityTagSubmissionDto, actorPublicId: string) {
    this.prisma.assertConfigured();

    const [target, actorUserId] = await Promise.all([
      this.resolveTarget(dto.targetType, dto.targetPublicId),
      this.resolveAuthenticatedUserId(actorPublicId)
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
          createdByUserSystemId: actorUserId,
          status: EntityTagStatus.ACTIVE
        },
        include: this.entityTagInclude
      });

      return this.mapEntityTag(item);
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async list(query: ListEntityTagsQueryDto) {
    this.prisma.assertConfigured();

    const target = await this.resolveTarget(query.targetType, query.targetPublicId);

    try {
      const items = await this.prisma.entityTag.findMany({
        where: {
          status: EntityTagStatus.ACTIVE,
          personId: target.personId,
          providerCompanyId: target.providerCompanyId,
          classification: query.classification
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: this.entityTagInclude
      });

      return {
        items: items.map((item) => this.mapEntityTag(item))
      };
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async findOne(publicId: string) {
    this.prisma.assertConfigured();

    try {
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

      return this.mapEntityTag(item);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Tag de entidade nao encontrada.'
      });
    }
  }

  async update(publicId: string, dto: UpdateEntityTagDto) {
    this.prisma.assertConfigured();

    await this.ensureActiveTag(publicId);

    try {
      const item = await this.prisma.entityTag.update({
        where: { publicId },
        data: {
          label: dto.label,
          content: dto.content,
          classification: dto.classification,
          color: dto.color ? this.normalizeColor(dto.color) : undefined,
          sortOrder: dto.sortOrder
        },
        include: this.entityTagInclude
      });

      return this.mapEntityTag(item);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Tag de entidade nao encontrada.'
      });
    }
  }

  async remove(publicId: string, actorPublicId: string) {
    this.prisma.assertConfigured();

    const actorUserId = await this.resolveAuthenticatedUserId(actorPublicId);

    await this.ensureActiveTag(publicId);

    try {
      const item = await this.prisma.entityTag.update({
        where: { publicId },
        data: {
          status: EntityTagStatus.REMOVED,
          removedAt: new Date(),
          removedByUserSystemId: actorUserId
        },
        include: this.entityTagInclude
      });

      return {
        publicId: item.publicId,
        status: item.status,
        removedAt: item.removedAt,
        removedBy: item.removedByUserSystem
          ? {
              publicId: item.removedByUserSystem.publicId,
              name: item.removedByUserSystem.name
            }
          : null
      };
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Tag de entidade nao encontrada.'
      });
    }
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

  private async ensureActiveTag(publicId: string): Promise<EntityTag> {
    const item = await this.prisma.entityTag.findFirst({
      where: {
        publicId,
        status: EntityTagStatus.ACTIVE
      }
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

  private normalizeColor(color?: string): string {
    return (color ?? '#536A75').toUpperCase();
  }

  private mapEntityTag(item: EntityTagWithRelations) {
    return {
      publicId: item.publicId,
      targetType: item.targetType,
      targetPublicId:
        item.person?.publicId ?? item.providerCompany?.publicId ?? null,
      classification: item.classification,
      status: item.status,
      label: item.label,
      content: item.content,
      color: item.color,
      sortOrder: item.sortOrder,
      isAnonymousSubmission: item.isAnonymousSubmission,
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
      createdByUserSystem: true,
      removedByUserSystem: true
    } satisfies Prisma.EntityTagInclude;
  }
}
