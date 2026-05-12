import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { buildPaginationArgs, buildPaginationMeta } from '../../common/utils/pagination';
import { rethrowPrismaError } from '../../common/utils/prisma-error';
import { createPublicId } from '../../common/utils/public-id';
import { tenantCreateRelation, tenantWhere } from '../../common/tenant/tenant-scope';
import { PrismaService } from '../../infra/database/prisma.service';
import { AuthTokenPayload } from '../auth/interfaces/auth-token-payload.interface';
import { CreateClientCompanyDto } from './dto/create-client-company.dto';
import { UpdateClientCompanyDto } from './dto/update-client-company.dto';

@Injectable()
export class ClientCompaniesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: PaginationQueryDto, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    const { page, perPage, skip } = buildPaginationArgs(query);
    const search = query.search?.trim();

    const searchWhere: Prisma.ClientCompanyWhereInput | undefined = search
      ? {
          OR: [
            { name: { contains: search } },
            { document: { contains: search } },
            { clientType: { contains: search } },
            { contactName: { contains: search } }
          ]
        }
      : undefined;
    const where = tenantWhere(actor, searchWhere);

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

  async findOne(publicId: string, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    try {
      const item = await this.prisma.clientCompany.findFirst({
        where: tenantWhere(actor, { publicId })
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

  async create(dto: CreateClientCompanyDto, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    try {
      const item = await this.prisma.clientCompany.create({
        data: {
          publicId: createPublicId('cli'),
          tenantRootCompany: tenantCreateRelation(actor),
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

  async update(publicId: string, dto: UpdateClientCompanyDto, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    try {
      const current = await this.resolveScopedClient(publicId, actor);
      const item = await this.prisma.clientCompany.update({
        where: { id: current.id },
        data: {
          name: dto.name?.trim(),
          document:
            dto.document === undefined ? undefined : dto.document.trim() || null,
          clientType: dto.clientType?.trim(),
          addressJson:
            dto.addressJson === undefined
              ? undefined
              : (dto.addressJson as Prisma.InputJsonValue),
          contactName:
            dto.contactName === undefined
              ? undefined
              : dto.contactName.trim() || null,
          status: dto.status?.trim()
        }
      });

      return this.mapClientCompany(item);
    } catch (error) {
      rethrowPrismaError(error, {
        duplicate: 'Ja existe cliente contratante com este documento.',
        notFound: 'Cliente contratante nao encontrado.'
      });
    }
  }

  async remove(publicId: string, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    try {
      const current = await this.resolveScopedClient(publicId, actor);
      const item = await this.prisma.clientCompany.update({
        where: { id: current.id },
        data: { status: 'INACTIVE' }
      });

      return this.mapClientCompany(item);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Cliente contratante nao encontrado.'
      });
    }
  }

  private async resolveScopedClient(
    publicId: string,
    actor: AuthTokenPayload
  ) {
    const item = await this.prisma.clientCompany.findFirst({
      where: tenantWhere(actor, { publicId }),
      select: { id: true }
    });

    if (!item) {
      throw new NotFoundException('Cliente contratante nao encontrado.');
    }

    return item;
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
