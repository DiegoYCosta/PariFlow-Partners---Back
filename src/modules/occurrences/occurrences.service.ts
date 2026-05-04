import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  OccurrenceNature,
  OccurrenceVisibility,
  Prisma
} from '@prisma/client';
import { buildPaginationArgs, buildPaginationMeta } from '../../common/utils/pagination';
import { rethrowPrismaError } from '../../common/utils/prisma-error';
import { createPublicId } from '../../common/utils/public-id';
import { PrismaService } from '../../infra/database/prisma.service';
import { CreateOccurrenceDto } from './dto/create-occurrence.dto';
import { ListOccurrencesQueryDto } from './dto/list-occurrences-query.dto';
import { UpdateOccurrenceDto } from './dto/update-occurrence.dto';

const occurrenceInclude = {
  person: true,
  providerCompany: true,
  employmentLink: true,
  position: {
    include: {
      service: true
    }
  },
  _count: {
    select: {
      attachments: true,
      receipts: true
    }
  }
} satisfies Prisma.OccurrenceInclude;

type OccurrenceWithRelations = Prisma.OccurrenceGetPayload<{
  include: typeof occurrenceInclude;
}>;

type OccurrenceResolvedRelations = {
  personId: bigint;
  providerCompanyId: bigint | null;
  employmentLinkId: bigint | null;
  positionId: bigint | null;
};

type OccurrenceRelationPatch = {
  providerCompanyPublicId?: string | null;
  employmentLinkPublicId?: string | null;
  positionPublicId?: string | null;
};

@Injectable()
export class OccurrencesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: ListOccurrencesQueryDto) {
    this.prisma.assertConfigured();

    const { page, perPage, skip } = buildPaginationArgs(query);
    const where = this.buildListWhere(query);

    try {
      const [total, items] = await Promise.all([
        this.prisma.occurrence.count({ where }),
        this.prisma.occurrence.findMany({
          where,
          skip,
          take: perPage,
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          include: occurrenceInclude
        })
      ]);

      return {
        items: items.map((item) => this.mapOccurrence(item)),
        pagination: buildPaginationMeta(page, perPage, total)
      };
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async findOne(publicId: string) {
    this.prisma.assertConfigured();

    try {
      const item = await this.loadOccurrence(publicId);

      if (!item || item.status === 'REMOVED') {
        throw new NotFoundException('Ocorrencia nao encontrada.');
      }

      return this.mapOccurrence(item);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Ocorrencia nao encontrada.'
      });
    }
  }

  async create(dto: CreateOccurrenceDto) {
    this.prisma.assertConfigured();

    const relations = await this.resolveRelationsForCreate(dto);

    try {
      const item = await this.prisma.occurrence.create({
        data: {
          publicId: createPublicId('ocr'),
          personId: relations.personId,
          providerCompanyId: relations.providerCompanyId,
          employmentLinkId: relations.employmentLinkId,
          positionId: relations.positionId,
          type: dto.type,
          scope: dto.scope,
          nature: dto.nature,
          title: dto.title,
          description: dto.description,
          occurredAt: new Date(dto.occurredAt),
          severityLevel: dto.severityLevel,
          visibility: dto.visibility ?? OccurrenceVisibility.INTERNAL,
          showInExecutivePanel: dto.showInExecutivePanel,
          status: dto.status ?? 'ACTIVE'
        },
        include: occurrenceInclude
      });

      return this.mapOccurrence(item);
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async update(publicId: string, dto: UpdateOccurrenceDto) {
    this.prisma.assertConfigured();

    const current = await this.loadOccurrence(publicId);

    if (!current || current.status === 'REMOVED') {
      throw new NotFoundException('Ocorrencia nao encontrada.');
    }

    const relations = await this.resolveRelationsForUpdate(current, dto);

    try {
      const updated = await this.prisma.occurrence.update({
        where: { publicId },
        data: {
          personId: relations.personId,
          providerCompanyId: relations.providerCompanyId,
          employmentLinkId: relations.employmentLinkId,
          positionId: relations.positionId,
          type: dto.type,
          scope: dto.scope,
          nature: dto.nature,
          title: dto.title,
          description: dto.description,
          occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
          severityLevel: dto.severityLevel,
          visibility: dto.visibility,
          showInExecutivePanel: dto.showInExecutivePanel,
          status: dto.status
        },
        include: occurrenceInclude
      });

      return this.mapOccurrence(updated);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Ocorrencia nao encontrada.'
      });
    }
  }

  async remove(publicId: string) {
    this.prisma.assertConfigured();

    const current = await this.loadOccurrence(publicId);

    if (!current || current.status === 'REMOVED') {
      throw new NotFoundException('Ocorrencia nao encontrada.');
    }

    try {
      const removed = await this.prisma.occurrence.update({
        where: { publicId },
        data: {
          status: 'REMOVED'
        },
        include: occurrenceInclude
      });

      return {
        publicId: removed.publicId,
        status: removed.status,
        updatedAt: removed.updatedAt
      };
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Ocorrencia nao encontrada.'
      });
    }
  }

  private buildListWhere(
    query: ListOccurrencesQueryDto
  ): Prisma.OccurrenceWhereInput | undefined {
    const filters: Prisma.OccurrenceWhereInput[] = [];
    const search = query.search?.trim();

    if (search) {
      filters.push({
        OR: [
          { title: { contains: search } },
          { description: { contains: search } },
          { type: { contains: search } },
          { scope: { contains: search } },
          { severityLevel: { contains: search } },
          { person: { is: { name: { contains: search } } } },
          { providerCompany: { is: { legalName: { contains: search } } } },
          { providerCompany: { is: { tradeName: { contains: search } } } },
          { position: { is: { name: { contains: search } } } }
        ]
      });
    }

    if (query.personPublicId) {
      filters.push({
        person: {
          is: {
            publicId: query.personPublicId
          }
        }
      });
    }

    if (query.providerCompanyPublicId) {
      filters.push({
        providerCompany: {
          is: {
            publicId: query.providerCompanyPublicId
          }
        }
      });
    }

    if (query.employmentLinkPublicId) {
      filters.push({
        employmentLink: {
          is: {
            publicId: query.employmentLinkPublicId
          }
        }
      });
    }

    if (query.positionPublicId) {
      filters.push({
        position: {
          is: {
            publicId: query.positionPublicId
          }
        }
      });
    }

    if (query.nature) {
      filters.push({
        nature: query.nature
      });
    }

    if (query.visibility) {
      filters.push({
        visibility: query.visibility
      });
    }

    filters.push(
      query.status
        ? {
            status: query.status
          }
        : {
            status: {
              not: 'REMOVED'
            }
          }
    );

    return {
      AND: filters
    };
  }

  private async resolveRelationsForCreate(
    dto: CreateOccurrenceDto
  ): Promise<OccurrenceResolvedRelations> {
    return this.resolveRelations({
      personPublicId: dto.personPublicId,
      providerCompanyPublicId: dto.providerCompanyPublicId,
      employmentLinkPublicId: dto.employmentLinkPublicId,
      positionPublicId: dto.positionPublicId
    });
  }

  private async resolveRelationsForUpdate(
    current: OccurrenceWithRelations,
    dto: UpdateOccurrenceDto
  ): Promise<OccurrenceResolvedRelations> {
    const patch = this.normalizeRelationPatch(dto);

    return this.resolveRelations({
      personPublicId: dto.personPublicId ?? current.person.publicId,
      providerCompanyPublicId:
        patch.providerCompanyPublicId !== undefined
          ? patch.providerCompanyPublicId
          : current.providerCompany?.publicId ?? null,
      employmentLinkPublicId:
        patch.employmentLinkPublicId !== undefined
          ? patch.employmentLinkPublicId
          : current.employmentLink?.publicId ?? null,
      positionPublicId:
        patch.positionPublicId !== undefined
          ? patch.positionPublicId
          : current.position?.publicId ?? null
    });
  }

  private normalizeRelationPatch(
    dto: UpdateOccurrenceDto
  ): OccurrenceRelationPatch {
    return {
      providerCompanyPublicId:
        dto.providerCompanyPublicId === undefined
          ? undefined
          : dto.providerCompanyPublicId.trim() || null,
      employmentLinkPublicId:
        dto.employmentLinkPublicId === undefined
          ? undefined
          : dto.employmentLinkPublicId.trim() || null,
      positionPublicId:
        dto.positionPublicId === undefined
          ? undefined
          : dto.positionPublicId.trim() || null
    };
  }

  private async resolveRelations(input: {
    personPublicId: string;
    providerCompanyPublicId?: string | null;
    employmentLinkPublicId?: string | null;
    positionPublicId?: string | null;
  }): Promise<OccurrenceResolvedRelations> {
    const [person, providerCompany, employmentLink, position] =
      await Promise.all([
        this.prisma.person.findUnique({
          where: { publicId: input.personPublicId },
          select: { id: true, publicId: true }
        }),
        input.providerCompanyPublicId
          ? this.prisma.providerCompany.findUnique({
              where: { publicId: input.providerCompanyPublicId },
              select: { id: true, publicId: true }
            })
          : Promise.resolve(null),
        input.employmentLinkPublicId
          ? this.prisma.employmentLink.findUnique({
              where: { publicId: input.employmentLinkPublicId },
              select: {
                id: true,
                publicId: true,
                personId: true,
                providerCompanyId: true,
                positionId: true
              }
            })
          : Promise.resolve(null),
        input.positionPublicId
          ? this.prisma.position.findUnique({
              where: { publicId: input.positionPublicId },
              select: { id: true, publicId: true }
            })
          : Promise.resolve(null)
      ]);

    if (!person) {
      throw new NotFoundException('Pessoa informada na ocorrencia nao encontrada.');
    }

    if (input.providerCompanyPublicId && !providerCompany) {
      throw new NotFoundException(
        'Empresa prestadora informada na ocorrencia nao encontrada.'
      );
    }

    if (input.employmentLinkPublicId && !employmentLink) {
      throw new NotFoundException('Vinculo informado na ocorrencia nao encontrado.');
    }

    if (input.positionPublicId && !position) {
      throw new NotFoundException('Posto informado na ocorrencia nao encontrado.');
    }

    if (employmentLink && employmentLink.personId !== person.id) {
      throw new BadRequestException(
        'O vinculo informado nao pertence a pessoa da ocorrencia.'
      );
    }

    if (
      providerCompany &&
      employmentLink &&
      employmentLink.providerCompanyId !== providerCompany.id
    ) {
      throw new BadRequestException(
        'A prestadora informada nao corresponde ao vinculo da ocorrencia.'
      );
    }

    if (position && employmentLink && employmentLink.positionId !== position.id) {
      throw new BadRequestException(
        'O posto informado nao corresponde ao vinculo da ocorrencia.'
      );
    }

    return {
      personId: person.id,
      providerCompanyId:
        providerCompany?.id ?? employmentLink?.providerCompanyId ?? null,
      employmentLinkId: employmentLink?.id ?? null,
      positionId: position?.id ?? employmentLink?.positionId ?? null
    };
  }

  private loadOccurrence(publicId: string) {
    return this.prisma.occurrence.findUnique({
      where: { publicId },
      include: occurrenceInclude
    });
  }

  private mapOccurrence(item: OccurrenceWithRelations) {
    return {
      publicId: item.publicId,
      type: item.type,
      scope: item.scope,
      nature: item.nature,
      title: item.title,
      description: item.description,
      occurredAt: item.occurredAt,
      severityLevel: item.severityLevel,
      visibility: item.visibility,
      showInExecutivePanel: item.showInExecutivePanel,
      status: item.status,
      person: {
        publicId: item.person.publicId,
        name: item.person.name,
        cpf: item.person.cpf,
        email: item.person.email,
        phone: item.person.phone
      },
      providerCompany: item.providerCompany
        ? {
            publicId: item.providerCompany.publicId,
            legalName: item.providerCompany.legalName,
            tradeName: item.providerCompany.tradeName,
            document: item.providerCompany.document
          }
        : null,
      employmentLink: item.employmentLink
        ? {
            publicId: item.employmentLink.publicId,
            type: item.employmentLink.type,
            status: item.employmentLink.status,
            startsAt: item.employmentLink.startsAt,
            endsAt: item.employmentLink.endsAt
          }
        : null,
      position: item.position
        ? {
            publicId: item.position.publicId,
            name: item.position.name,
            location: item.position.location,
            shift: item.position.shift,
            schedule: item.position.schedule,
            status: item.position.status,
            service: {
              publicId: item.position.service.publicId,
              name: item.position.service.name,
              category: item.position.service.category
            }
          }
        : null,
      attachmentCount: item._count.attachments,
      receiptCount: item._count.receipts,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }
}
