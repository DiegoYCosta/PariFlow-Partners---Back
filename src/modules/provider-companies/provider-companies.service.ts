import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { buildPaginationArgs, buildPaginationMeta } from '../../common/utils/pagination';
import { rethrowPrismaError } from '../../common/utils/prisma-error';
import { createPublicId } from '../../common/utils/public-id';
import { tenantCreateRelation, tenantWhere } from '../../common/tenant/tenant-scope';
import { PrismaService } from '../../infra/database/prisma.service';
import { AuthTokenPayload } from '../auth/interfaces/auth-token-payload.interface';
import { CreateProviderCompanyDto } from './dto/create-provider-company.dto';
import { UpdateProviderCompanyDto } from './dto/update-provider-company.dto';

type ProviderCompanyWithCounts = Prisma.ProviderCompanyGetPayload<{
  include: {
    _count: {
      select: {
        contracts: true;
        links: true;
        occurrences: true;
      };
    };
  };
}>;

type ProviderCompanyBase = Prisma.ProviderCompanyGetPayload<Record<string, never>>;

@Injectable()
export class ProviderCompaniesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: PaginationQueryDto, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    const { page, perPage, skip } = buildPaginationArgs(query);
    const search = query.search?.trim();

    const searchWhere: Prisma.ProviderCompanyWhereInput | undefined = search
      ? {
          OR: [
            { legalName: { contains: search } },
            { tradeName: { contains: search } },
            { document: { contains: search } }
          ]
        }
      : undefined;
    const where = tenantWhere(actor, searchWhere);

    try {
      const [total, items] = await Promise.all([
        this.prisma.providerCompany.count({ where }),
        this.prisma.providerCompany.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: {
                contracts: true,
                links: true,
                occurrences: true
              }
            }
          }
        })
      ]);

      return {
        items: items.map((item) => this.mapProviderCompany(item)),
        pagination: buildPaginationMeta(page, perPage, total)
      };
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async findOne(publicId: string, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    try {
      const item = await this.prisma.providerCompany.findFirst({
        where: tenantWhere(actor, { publicId })
      });

      if (!item) {
        throw new NotFoundException('Empresa prestadora nao encontrada.');
      }

      return this.mapProviderCompany(item);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Empresa prestadora nao encontrada.'
      });
    }
  }

  async create(dto: CreateProviderCompanyDto, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    try {
      const item = await this.prisma.providerCompany.create({
        data: {
          publicId: createPublicId('epr'),
          tenantRootCompany: tenantCreateRelation(actor),
          legalName: dto.legalName,
          tradeName: dto.tradeName ?? null,
          document: dto.document,
          status: dto.status,
          contactsJson: dto.contactsJson as Prisma.InputJsonValue | undefined,
          addressJson: dto.addressJson as Prisma.InputJsonValue | undefined,
          notes: dto.notes ?? null
        }
      });

      return this.mapProviderCompany(item);
    } catch (error) {
      rethrowPrismaError(error, {
        duplicate: 'Ja existe empresa prestadora com este documento.'
      });
    }
  }

  async update(publicId: string, dto: UpdateProviderCompanyDto, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    try {
      const current = await this.resolveScopedProvider(publicId, actor);
      const item = await this.prisma.providerCompany.update({
        where: { id: current.id },
        data: {
          legalName: dto.legalName?.trim(),
          tradeName:
            dto.tradeName === undefined ? undefined : dto.tradeName.trim() || null,
          document: dto.document?.trim(),
          status: dto.status?.trim(),
          contactsJson:
            dto.contactsJson === undefined
              ? undefined
              : (dto.contactsJson as Prisma.InputJsonValue),
          addressJson:
            dto.addressJson === undefined
              ? undefined
              : (dto.addressJson as Prisma.InputJsonValue),
          notes: dto.notes === undefined ? undefined : dto.notes.trim() || null
        }
      });

      return this.mapProviderCompany(item);
    } catch (error) {
      rethrowPrismaError(error, {
        duplicate: 'Ja existe empresa prestadora com este documento.',
        notFound: 'Empresa prestadora nao encontrada.'
      });
    }
  }

  async remove(publicId: string, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    try {
      const current = await this.resolveScopedProvider(publicId, actor);
      const item = await this.prisma.providerCompany.update({
        where: { id: current.id },
        data: { status: 'INACTIVE' }
      });

      return this.mapProviderCompany(item);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Empresa prestadora nao encontrada.'
      });
    }
  }

  private async resolveScopedProvider(
    publicId: string,
    actor: AuthTokenPayload
  ) {
    const item = await this.prisma.providerCompany.findFirst({
      where: tenantWhere(actor, { publicId }),
      select: { id: true }
    });

    if (!item) {
      throw new NotFoundException('Empresa prestadora nao encontrada.');
    }

    return item;
  }

  private mapProviderCompany(
    item:
      | ProviderCompanyBase
      | ProviderCompanyWithCounts
  ) {
    return {
      publicId: item.publicId,
      legalName: item.legalName,
      tradeName: item.tradeName,
      document: item.document,
      status: item.status,
      contactsJson: item.contactsJson,
      addressJson: item.addressJson,
      notes: item.notes,
      contractCount: '_count' in item ? item._count.contracts : undefined,
      linkCount: '_count' in item ? item._count.links : undefined,
      occurrenceCount: '_count' in item ? item._count.occurrences : undefined,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }
}
