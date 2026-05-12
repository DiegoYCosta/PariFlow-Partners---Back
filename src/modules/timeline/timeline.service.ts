import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TimelineRecordLink } from '@prisma/client';
import { tenantCreateRelation, tenantWhere } from '../../common/tenant/tenant-scope';
import {
  buildPaginationArgs,
  buildPaginationMeta
} from '../../common/utils/pagination';
import { createPublicId } from '../../common/utils/public-id';
import { rethrowPrismaError } from '../../common/utils/prisma-error';
import { PrismaService } from '../../infra/database/prisma.service';
import { AuthTokenPayload } from '../auth/interfaces/auth-token-payload.interface';
import { CreateTimelineRecordDto } from './dto/create-timeline-record.dto';
import { ListTimelineRecordsQueryDto } from './dto/list-timeline-records-query.dto';
import { TimelineRecordLinkDto } from './dto/timeline-record-link.dto';
import { UpdateTimelineRecordDto } from './dto/update-timeline-record.dto';

const timelineInclude = {
  links: {
    orderBy: [{ entityType: 'asc' }, { id: 'asc' }]
  }
} satisfies Prisma.TimelineRecordInclude;

type TimelineRecordWithLinks = Prisma.TimelineRecordGetPayload<{
  include: typeof timelineInclude;
}>;

@Injectable()
export class TimelineService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: ListTimelineRecordsQueryDto, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    const { page, perPage, skip } = buildPaginationArgs(query);
    const where = tenantWhere(actor, this.buildListWhere(query));

    try {
      const [total, items] = await Promise.all([
        this.prisma.timelineRecord.count({ where }),
        this.prisma.timelineRecord.findMany({
          where,
          skip,
          take: perPage,
          orderBy: [{ referenceMonth: 'desc' }, { eventDate: 'desc' }, { id: 'desc' }],
          include: timelineInclude
        })
      ]);

      return {
        items: items.map((item) => this.mapRecord(item)),
        pagination: buildPaginationMeta(page, perPage, total)
      };
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async findOne(publicId: string, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    try {
      const item = await this.loadRecord(publicId, actor);
      if (!item || item.status === 'REMOVED') {
        throw new NotFoundException('Registro de timeline nao encontrado.');
      }
      return this.mapRecord(item);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Registro de timeline nao encontrado.'
      });
    }
  }

  async create(dto: CreateTimelineRecordDto, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    const links = await this.normalizeLinks(dto.links ?? [], actor);
    const referenceMonth = this.parseReferenceMonth(dto.referenceMonth);
    const eventDate = dto.isMonthOnly ? null : this.parseEventDate(dto.eventDate);

    try {
      const actorSnapshot = await this.resolveActorSnapshot(actor);
      const item = await this.prisma.timelineRecord.create({
        data: {
          publicId: createPublicId('tlr'),
          tenantRootCompany: tenantCreateRelation(actor),
          title: dto.title,
          description: dto.description,
          category: dto.category,
          nature: dto.nature,
          referenceMonth,
          eventDate,
          visibility: dto.visibility,
          status: dto.status ?? 'ACTIVE',
          createdByUserSystemPublicId: actorSnapshot.publicId,
          createdByUserSystemName: actorSnapshot.name,
          links: {
            create: links.map((link) => ({
              publicId: createPublicId('tll'),
              entityType: link.entityType,
              entityPublicId: link.entityPublicId ?? null,
              labelSnapshot: link.labelSnapshot,
              notes: link.notes ?? null
            }))
          }
        },
        include: timelineInclude
      });

      return this.mapRecord(item);
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async update(
    publicId: string,
    dto: UpdateTimelineRecordDto,
    actor: AuthTokenPayload
  ) {
    this.prisma.assertConfigured();

    const current = await this.loadRecord(publicId, actor);
    if (!current || current.status === 'REMOVED') {
      throw new NotFoundException('Registro de timeline nao encontrado.');
    }

    const shouldReplaceLinks = dto.links !== undefined;
    const links = shouldReplaceLinks
      ? await this.normalizeLinks(dto.links ?? [], actor)
      : [];
    const referenceMonth = dto.referenceMonth
      ? this.parseReferenceMonth(dto.referenceMonth)
      : undefined;
    const eventDate =
      dto.isMonthOnly === true
        ? null
        : dto.eventDate
          ? this.parseEventDate(dto.eventDate)
          : undefined;

    try {
      const actorSnapshot = await this.resolveActorSnapshot(actor);
      const item = await this.prisma.timelineRecord.update({
        where: { id: current.id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.category !== undefined ? { category: dto.category } : {}),
          ...(dto.nature !== undefined ? { nature: dto.nature } : {}),
          ...(referenceMonth ? { referenceMonth } : {}),
          ...(eventDate !== undefined ? { eventDate } : {}),
          ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          updatedByUserSystemPublicId: actorSnapshot.publicId,
          updatedByUserSystemName: actorSnapshot.name,
          ...(dto.editJustification !== undefined
            ? { lastEditJustification: dto.editJustification }
            : {}),
          ...(shouldReplaceLinks
            ? {
                links: {
                  deleteMany: {},
                  create: links.map((link) => ({
                    publicId: createPublicId('tll'),
                    entityType: link.entityType,
                    entityPublicId: link.entityPublicId ?? null,
                    labelSnapshot: link.labelSnapshot,
                    notes: link.notes ?? null
                  }))
                }
              }
            : {})
        },
        include: timelineInclude
      });

      return this.mapRecord(item);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Registro de timeline nao encontrado.'
      });
    }
  }

  async remove(publicId: string, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    const current = await this.loadRecord(publicId, actor);
    if (!current || current.status === 'REMOVED') {
      throw new NotFoundException('Registro de timeline nao encontrado.');
    }

    const removed = await this.prisma.timelineRecord.update({
      where: { id: current.id },
      data: { status: 'REMOVED' },
      include: timelineInclude
    });

    return this.mapRecord(removed);
  }

  private buildListWhere(
    query: ListTimelineRecordsQueryDto
  ): Prisma.TimelineRecordWhereInput {
    const filters: Prisma.TimelineRecordWhereInput[] = [];
    const search = query.search?.trim();

    if (search) {
      filters.push({
        OR: [
          { title: { contains: search } },
          { description: { contains: search } },
          { category: { contains: search } },
          { links: { some: { labelSnapshot: { contains: search } } } },
          { links: { some: { notes: { contains: search } } } }
        ]
      });
    }

    if (query.referenceMonth) {
      filters.push({ referenceMonth: this.parseReferenceMonth(query.referenceMonth) });
    }

    if (query.category) {
      filters.push({ category: query.category });
    }

    if (query.nature) {
      filters.push({ nature: query.nature });
    }

    if (query.visibility) {
      filters.push({ visibility: query.visibility });
    }

    if (query.entityType || query.entityPublicId) {
      filters.push({
        links: {
          some: {
            ...(query.entityType ? { entityType: query.entityType } : {}),
            ...(query.entityPublicId ? { entityPublicId: query.entityPublicId } : {})
          }
        }
      });
    }

    if (query.monthOnly) {
      filters.push({ eventDate: null });
    }

    filters.push(
      query.status
        ? { status: query.status }
        : {
            status: { not: 'REMOVED' }
          }
    );

    return { AND: filters };
  }

  private async normalizeLinks(
    links: TimelineRecordLinkDto[],
    actor: AuthTokenPayload
  ) {
    const normalized = [];
    for (const link of links) {
      const label = await this.resolveLinkLabel(link, actor);
      if (!label) {
        continue;
      }
      normalized.push({
        entityType: link.entityType,
        entityPublicId: link.entityPublicId,
        labelSnapshot: label,
        notes: link.notes
      });
    }
    return normalized;
  }

  private async resolveLinkLabel(
    link: TimelineRecordLinkDto,
    actor: AuthTokenPayload
  ): Promise<string> {
    const fallback = link.labelSnapshot?.trim();
    const publicId = link.entityPublicId?.trim();
    if (!publicId) {
      return fallback ?? '';
    }

    switch (link.entityType) {
      case 'PROVIDER_COMPANY': {
        const item = await this.prisma.providerCompany.findFirst({
          where: tenantWhere(actor, { publicId }),
          select: { legalName: true, tradeName: true }
        });
        if (!item) {
          throw new NotFoundException('Empresa prestadora vinculada nao encontrada.');
        }
        return item.tradeName ?? item.legalName;
      }
      case 'CLIENT_COMPANY': {
        const item = await this.prisma.clientCompany.findFirst({
          where: tenantWhere(actor, { publicId }),
          select: { name: true }
        });
        if (!item) {
          throw new NotFoundException('Cliente vinculado nao encontrado.');
        }
        return item.name;
      }
      case 'CONTRACT': {
        const item = await this.prisma.contract.findFirst({
          where: tenantWhere(actor, { publicId }),
          include: { providerCompany: true, clientCompany: true, contractType: true }
        });
        if (!item) {
          throw new NotFoundException('Contrato vinculado nao encontrado.');
        }
        const provider = item.providerCompany.tradeName ?? item.providerCompany.legalName;
        const type = item.contractType?.name ?? 'Contrato';
        return `${type} | ${provider} -> ${item.clientCompany.name}`;
      }
      case 'PERSON': {
        const item = await this.prisma.person.findFirst({
          where: tenantWhere(actor, { publicId }),
          select: { name: true }
        });
        if (!item) {
          throw new NotFoundException('Pessoa vinculada nao encontrada.');
        }
        return item.name;
      }
      case 'EMPLOYMENT_LINK': {
        const item = await this.prisma.employmentLink.findFirst({
          where: tenantWhere(actor, { publicId }),
          include: { person: true, providerCompany: true }
        });
        if (!item) {
          throw new NotFoundException('Vinculo vinculado nao encontrado.');
        }
        const provider = item.providerCompany.tradeName ?? item.providerCompany.legalName;
        return `${item.person.name} | ${provider}`;
      }
      case 'POSITION': {
        const item = await this.prisma.position.findFirst({
          where: tenantWhere(actor, { publicId }),
          select: { name: true }
        });
        if (!item) {
          throw new NotFoundException('Posto vinculado nao encontrado.');
        }
        return item.name;
      }
      default:
        return fallback ?? publicId;
    }
  }

  private loadRecord(publicId: string, actor: AuthTokenPayload) {
    return this.prisma.timelineRecord.findFirst({
      where: tenantWhere(actor, { publicId }),
      include: timelineInclude
    });
  }

  private async resolveActorSnapshot(actor: AuthTokenPayload) {
    const user = await this.prisma.userSystem.findUnique({
      where: { publicId: actor.sub },
      select: { publicId: true, name: true, email: true }
    });
    return {
      publicId: user?.publicId ?? actor.sub,
      name: user?.name ?? user?.email ?? actor.email ?? actor.sub
    };
  }

  private parseReferenceMonth(value: string): Date {
    const [year, month] = value.split('-').map(Number);
    return new Date(year, month - 1, 1, 0, 0, 0, 0);
  }

  private parseEventDate(value?: string): Date | null {
    if (!value) {
      return null;
    }
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  private mapRecord(item: TimelineRecordWithLinks) {
    return {
      publicId: item.publicId,
      title: item.title,
      description: item.description,
      category: item.category,
      categoryLabel: this.titleCase(item.category),
      nature: item.nature,
      referenceMonth: item.referenceMonth,
      referenceMonthLabel: this.referenceMonthLabel(item.referenceMonth),
      eventDate: item.eventDate,
      eventDateLabel: item.eventDate ? this.formatDate(item.eventDate) : '',
      monthOnly: item.eventDate === null,
      visibility: item.visibility,
      status: item.status,
      createdByUserSystemPublicId: item.createdByUserSystemPublicId,
      createdBy: item.createdByUserSystemPublicId
        ? {
            publicId: item.createdByUserSystemPublicId,
            name: item.createdByUserSystemName ?? item.createdByUserSystemPublicId
          }
        : null,
      updatedBy: item.updatedByUserSystemPublicId
        ? {
            publicId: item.updatedByUserSystemPublicId,
            name: item.updatedByUserSystemName ?? item.updatedByUserSystemPublicId
          }
        : null,
      lastEditJustification: item.lastEditJustification ?? '',
      links: item.links.map((link) => this.mapLink(link)),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }

  private mapLink(link: TimelineRecordLink) {
    return {
      publicId: link.publicId,
      entityType: link.entityType,
      entityTypeLabel: this.linkTypeLabel(link.entityType),
      entityPublicId: link.entityPublicId,
      labelSnapshot: link.labelSnapshot,
      notes: link.notes ?? ''
    };
  }

  private referenceMonthLabel(date: Date): string {
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  }

  private formatDate(date: Date): string {
    return `${String(date.getDate()).padStart(2, '0')}/${String(
      date.getMonth() + 1
    ).padStart(2, '0')}/${date.getFullYear()}`;
  }

  private titleCase(value: string): string {
    return value
      .toLowerCase()
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(' ');
  }

  private linkTypeLabel(value: string): string {
    switch (value) {
      case 'PROVIDER_COMPANY':
        return 'Prestadora';
      case 'CLIENT_COMPANY':
        return 'Cliente';
      case 'CONTRACT':
        return 'Contrato';
      case 'CONTRACT_TEXT':
        return 'Contrato informado';
      case 'PERSON':
        return 'Funcionario';
      case 'EMPLOYMENT_LINK':
        return 'Vinculo';
      case 'POSITION':
        return 'Posto';
      case 'GROUP':
        return 'Grupo';
      case 'CITY':
        return 'Cidade';
      default:
        return 'Outro';
    }
  }
}
