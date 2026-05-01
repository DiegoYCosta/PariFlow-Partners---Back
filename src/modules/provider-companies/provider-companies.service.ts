import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { buildPaginationArgs, buildPaginationMeta } from '../../common/utils/pagination';
import { rethrowPrismaError } from '../../common/utils/prisma-error';
import { createPublicId } from '../../common/utils/public-id';
import { PrismaService } from '../../infra/database/prisma.service';
import { CreateProviderCompanyDto } from './dto/create-provider-company.dto';

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
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PaginationQueryDto) {
    this.prisma.assertConfigured();

    const { page, perPage, skip } = buildPaginationArgs(query);
    const search = query.search?.trim();

    const where: Prisma.ProviderCompanyWhereInput | undefined = search
      ? {
          OR: [
            { legalName: { contains: search } },
            { tradeName: { contains: search } },
            { document: { contains: search } }
          ]
        }
      : undefined;

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

  async findOne(publicId: string) {
    this.prisma.assertConfigured();

    try {
      const item = await this.prisma.providerCompany.findUnique({
        where: { publicId }
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

  async create(dto: CreateProviderCompanyDto) {
    this.prisma.assertConfigured();

    try {
      const item = await this.prisma.providerCompany.create({
        data: {
          publicId: createPublicId('epr'),
          legalName: dto.legalName,
          tradeName: dto.tradeName ?? null,
          document: dto.document,
          status: dto.status,
          contactsJson: dto.contactsJson as Prisma.InputJsonValue | undefined,
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
      notes: item.notes,
      contractCount: '_count' in item ? item._count.contracts : undefined,
      linkCount: '_count' in item ? item._count.links : undefined,
      occurrenceCount: '_count' in item ? item._count.occurrences : undefined,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }
}