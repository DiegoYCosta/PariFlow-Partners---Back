import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { buildPaginationArgs, buildPaginationMeta } from '../../common/utils/pagination';
import { rethrowPrismaError } from '../../common/utils/prisma-error';
import { createPublicId } from '../../common/utils/public-id';
import { PrismaService } from '../../infra/database/prisma.service';
import { CreateClientCompanyDto } from './dto/create-client-company.dto';

@Injectable()
export class ClientCompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PaginationQueryDto) {
    this.prisma.assertConfigured();

    const { page, perPage, skip } = buildPaginationArgs(query);
    const search = query.search?.trim();

    const where: Prisma.ClientCompanyWhereInput | undefined = search
      ? {
          OR: [
            { name: { contains: search } },
            { document: { contains: search } },
            { clientType: { contains: search } },
            { contactName: { contains: search } }
          ]
        }
      : undefined;

    try {
      const [total, items] = await Promise.all([
        this.prisma.clientCompany.count({ where }),
        this.prisma.clientCompany.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' }
        })
      ]);

      return {
        items: items.map((item) => this.mapClientCompany(item)),
        pagination: buildPaginationMeta(page, perPage, total)
      };
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async findOne(publicId: string) {
    this.prisma.assertConfigured();

    try {
      const item = await this.prisma.clientCompany.findUnique({
        where: { publicId }
      });

      if (!item) {
        throw new NotFoundException('Cliente contratante nao encontrado.');
      }

      return this.mapClientCompany(item);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Cliente contratante nao encontrado.'
      });
    }
  }

  async create(dto: CreateClientCompanyDto) {
    this.prisma.assertConfigured();

    try {
      const item = await this.prisma.clientCompany.create({
        data: {
          publicId: createPublicId('cli'),
          name: dto.name,
          document: dto.document ?? null,
          clientType: dto.clientType,
          addressJson: dto.addressJson as Prisma.InputJsonValue | undefined,
          contactName: dto.contactName ?? null,
          status: dto.status
        }
      });

      return this.mapClientCompany(item);
    } catch (error) {
      rethrowPrismaError(error, {
        duplicate: 'Ja existe cliente contratante com este documento.'
      });
    }
  }

  private mapClientCompany(
    item: Awaited<ReturnType<PrismaService['clientCompany']['findFirstOrThrow']>>
  ) {
    return {
      publicId: item.publicId,
      name: item.name,
      document: item.document,
      clientType: item.clientType,
      addressJson: item.addressJson,
      contactName: item.contactName,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }
}
