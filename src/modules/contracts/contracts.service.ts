import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { buildPaginationArgs, buildPaginationMeta } from '../../common/utils/pagination';
import { rethrowPrismaError } from '../../common/utils/prisma-error';
import { createPublicId } from '../../common/utils/public-id';
import { PrismaService } from '../../infra/database/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';

@Injectable()
export class ContractsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: PaginationQueryDto) {
    this.prisma.assertConfigured();

    const { page, perPage, skip } = buildPaginationArgs(query);
    const search = query.search?.trim();

    const where: Prisma.ContractWhereInput | undefined = search
      ? {
          OR: [
            { status: { contains: search } },
            { providerCompany: { is: { legalName: { contains: search } } } },
            { providerCompany: { is: { tradeName: { contains: search } } } },
            { clientCompany: { is: { name: { contains: search } } } }
          ]
        }
      : undefined;

    try {
      const [total, items] = await Promise.all([
        this.prisma.contract.count({ where }),
        this.prisma.contract.findMany({
          where,
          skip,
          take: perPage,
          orderBy: { createdAt: 'desc' },
          include: {
            providerCompany: true,
            clientCompany: true
          }
        })
      ]);

      return {
        items: items.map((item) => this.mapContract(item)),
        pagination: buildPaginationMeta(page, perPage, total)
      };
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async findOne(publicId: string) {
    this.prisma.assertConfigured();

    try {
      const item = await this.prisma.contract.findUnique({
        where: { publicId },
        include: {
          providerCompany: true,
          clientCompany: true
        }
      });

      if (!item) {
        throw new NotFoundException('Contrato nao encontrado.');
      }

      return this.mapContract(item);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Contrato nao encontrado.'
      });
    }
  }

  async create(dto: CreateContractDto) {
    this.prisma.assertConfigured();

    try {
      const [providerCompany, clientCompany] = await Promise.all([
        this.prisma.providerCompany.findUnique({
          where: { publicId: dto.providerCompanyPublicId }
        }),
        this.prisma.clientCompany.findUnique({
          where: { publicId: dto.clientCompanyPublicId }
        })
      ]);

      if (!providerCompany) {
        throw new NotFoundException('Empresa prestadora informada nao encontrada.');
      }

      if (!clientCompany) {
        throw new NotFoundException('Cliente contratante informado nao encontrado.');
      }

      const item = await this.prisma.contract.create({
        data: {
          publicId: createPublicId('ctr'),
          providerCompanyId: providerCompany.id,
          clientCompanyId: clientCompany.id,
          startsAt: new Date(dto.startsAt),
          endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
          status: dto.status,
          notes: dto.notes ?? null
        },
        include: {
          providerCompany: true,
          clientCompany: true
        }
      });

      return this.mapContract(item);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Empresa prestadora ou cliente contratante nao encontrado.'
      });
    }
  }

  private mapContract(
    item: Awaited<
      ReturnType<
        PrismaService['contract']['findFirstOrThrow']
      >
    > & {
      providerCompany?: {
        publicId: string;
        legalName: string;
        tradeName: string | null;
        document: string;
      };
      clientCompany?: {
        publicId: string;
        name: string;
        document: string | null;
        clientType: string;
      };
    }
  ) {
    // O contrato já retorna o contexto agregado para o front não depender de
    // consultas extras quando os módulos de posto, vínculo e painéis forem entrando.
    return {
      publicId: item.publicId,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      status: item.status,
      notes: item.notes,
      providerCompany: item.providerCompany
        ? {
            publicId: item.providerCompany.publicId,
            legalName: item.providerCompany.legalName,
            tradeName: item.providerCompany.tradeName,
            document: item.providerCompany.document
          }
        : null,
      clientCompany: item.clientCompany
        ? {
            publicId: item.clientCompany.publicId,
            name: item.clientCompany.name,
            document: item.clientCompany.document,
            clientType: item.clientCompany.clientType
          }
        : null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }
}
