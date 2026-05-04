import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  ContractCatalogStatus,
  ContractDocumentStatus,
  Prisma
} from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  buildPaginationArgs,
  buildPaginationMeta
} from '../../common/utils/pagination';
import { rethrowPrismaError } from '../../common/utils/prisma-error';
import { createPublicId } from '../../common/utils/public-id';
import { PrismaService } from '../../infra/database/prisma.service';
import { CreateContractDocumentDto } from './dto/create-contract-document.dto';
import { CreateContractModelDto } from './dto/create-contract-model.dto';
import { CreateContractTypeDto } from './dto/create-contract-type.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDocumentDto } from './dto/update-contract-document.dto';
import { UpdateContractModelDto } from './dto/update-contract-model.dto';
import { UpdateContractTypeDto } from './dto/update-contract-type.dto';

const contractInclude = {
  providerCompany: true,
  clientCompany: true,
  contractType: true,
  contractModel: {
    include: {
      contractType: true
    }
  },
  positions: {
    include: {
      service: true
    },
    orderBy: {
      name: 'asc'
    }
  },
  documents: {
    where: {
      status: ContractDocumentStatus.ACTIVE
    },
    orderBy: {
      createdAt: 'desc'
    }
  }
} satisfies Prisma.ContractInclude;

type ContractWithRelations = Prisma.ContractGetPayload<{
  include: typeof contractInclude;
}>;

type ContractModelWithType = Prisma.ContractModelGetPayload<{
  include: {
    contractType: true;
  };
}>;

@Injectable()
export class ContractsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: PaginationQueryDto) {
    this.prisma.assertConfigured();
    await this.ensureDefaultContractType();

    const { page, perPage, skip } = buildPaginationArgs(query);
    const search = query.search?.trim();

    const where: Prisma.ContractWhereInput | undefined = search
      ? {
          OR: [
            { publicId: { contains: search } },
            { status: { contains: search } },
            { notes: { contains: search } },
            { providerCompany: { is: { legalName: { contains: search } } } },
            { providerCompany: { is: { tradeName: { contains: search } } } },
            { clientCompany: { is: { name: { contains: search } } } },
            { contractType: { is: { name: { contains: search } } } },
            { contractModel: { is: { name: { contains: search } } } }
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
          include: contractInclude
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
    await this.ensureDefaultContractType();

    try {
      const item = await this.prisma.contract.findUnique({
        where: { publicId },
        include: contractInclude
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
      const [providerCompany, clientCompany, resolvedCatalog] =
        await Promise.all([
          this.prisma.providerCompany.findUnique({
            where: { publicId: dto.providerCompanyPublicId }
          }),
          this.prisma.clientCompany.findUnique({
            where: { publicId: dto.clientCompanyPublicId }
          }),
          this.resolveContractCatalog(
            dto.contractTypePublicId,
            dto.contractModelPublicId
          )
        ]);

      if (!providerCompany) {
        throw new NotFoundException(
          'Empresa prestadora informada nao encontrada.'
        );
      }

      if (!clientCompany) {
        throw new NotFoundException(
          'Cliente contratante informado nao encontrado.'
        );
      }

      const item = await this.prisma.contract.create({
        data: {
          publicId: createPublicId('ctr'),
          providerCompanyId: providerCompany.id,
          clientCompanyId: clientCompany.id,
          contractTypeId: resolvedCatalog.contractType.id,
          contractModelId: resolvedCatalog.contractModel?.id,
          startsAt: new Date(dto.startsAt),
          endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
          status: dto.status,
          notes: dto.notes ?? null
        },
        include: contractInclude
      });

      return this.mapContract(item);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound:
          'Empresa prestadora, cliente, tipo ou modelo de contrato nao encontrado.'
      });
    }
  }

  async listTypes() {
    this.prisma.assertConfigured();
    await this.ensureDefaultContractType();

    const items = await this.prisma.contractType.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: {
            contractModels: true,
            contracts: true
          }
        }
      }
    });

    return {
      items: items.map((item) => ({
        publicId: item.publicId,
        name: item.name,
        description: item.description,
        status: item.status,
        modelCount: item._count.contractModels,
        contractCount: item._count.contracts,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }))
    };
  }

  async createType(dto: CreateContractTypeDto) {
    this.prisma.assertConfigured();

    try {
      const item = await this.prisma.contractType.create({
        data: {
          publicId: createPublicId('tco'),
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          status: dto.status ?? ContractCatalogStatus.ACTIVE
        }
      });

      return this.mapContractType(item);
    } catch (error) {
      rethrowPrismaError(error, {
        duplicate: 'Ja existe tipo de contrato com este nome.'
      });
    }
  }

  async updateType(publicId: string, dto: UpdateContractTypeDto) {
    this.prisma.assertConfigured();

    if (dto.status === ContractCatalogStatus.INACTIVE) {
      await this.ensureAnotherActiveType(publicId);
    }

    try {
      const item = await this.prisma.contractType.update({
        where: { publicId },
        data: {
          name: dto.name?.trim(),
          description:
            dto.description === undefined
              ? undefined
              : dto.description.trim() || null,
          status: dto.status
        }
      });

      return this.mapContractType(item);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Tipo de contrato nao encontrado.',
        duplicate: 'Ja existe tipo de contrato com este nome.'
      });
    }
  }

  async removeType(publicId: string) {
    this.prisma.assertConfigured();
    await this.ensureAnotherActiveType(publicId);

    try {
      const item = await this.prisma.contractType.update({
        where: { publicId },
        data: { status: ContractCatalogStatus.INACTIVE }
      });

      return this.mapContractType(item);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Tipo de contrato nao encontrado.'
      });
    }
  }

  async listModels() {
    this.prisma.assertConfigured();
    await this.ensureDefaultContractType();

    const items = await this.prisma.contractModel.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: {
        contractType: true,
        _count: {
          select: {
            contracts: true
          }
        }
      }
    });

    return {
      items: items.map((item) => ({
        ...this.mapContractModel(item),
        contractCount: item._count.contracts
      }))
    };
  }

  async createModel(dto: CreateContractModelDto) {
    this.prisma.assertConfigured();
    const contractType = await this.resolveActiveContractType(
      dto.contractTypePublicId
    );

    try {
      const item = await this.prisma.contractModel.create({
        data: {
          publicId: createPublicId('mco'),
          contractTypeId: contractType.id,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          defaultSchedule: dto.defaultSchedule?.trim() || null,
          status: dto.status ?? ContractCatalogStatus.ACTIVE
        },
        include: { contractType: true }
      });

      return this.mapContractModel(item);
    } catch (error) {
      rethrowPrismaError(error, {
        duplicate:
          'Ja existe modelo de contrato com este nome para o tipo escolhido.'
      });
    }
  }

  async updateModel(publicId: string, dto: UpdateContractModelDto) {
    this.prisma.assertConfigured();
    const contractTypeId = dto.contractTypePublicId
      ? (await this.resolveActiveContractType(dto.contractTypePublicId)).id
      : undefined;

    try {
      const item = await this.prisma.contractModel.update({
        where: { publicId },
        data: {
          contractTypeId,
          name: dto.name?.trim(),
          description:
            dto.description === undefined
              ? undefined
              : dto.description.trim() || null,
          defaultSchedule:
            dto.defaultSchedule === undefined
              ? undefined
              : dto.defaultSchedule.trim() || null,
          status: dto.status
        },
        include: { contractType: true }
      });

      return this.mapContractModel(item);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Modelo de contrato nao encontrado.',
        duplicate:
          'Ja existe modelo de contrato com este nome para o tipo escolhido.'
      });
    }
  }

  async removeModel(publicId: string) {
    this.prisma.assertConfigured();

    try {
      const item = await this.prisma.contractModel.update({
        where: { publicId },
        data: { status: ContractCatalogStatus.INACTIVE },
        include: { contractType: true }
      });

      return this.mapContractModel(item);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Modelo de contrato nao encontrado.'
      });
    }
  }

  async listDocuments(contractPublicId: string) {
    this.prisma.assertConfigured();
    const contractId = await this.resolveContractId(contractPublicId);

    const items = await this.prisma.contractDocument.findMany({
      where: {
        contractId,
        status: ContractDocumentStatus.ACTIVE
      },
      orderBy: { createdAt: 'desc' }
    });

    return { items: items.map((item) => this.mapContractDocument(item)) };
  }

  async createDocument(
    contractPublicId: string,
    dto: CreateContractDocumentDto
  ) {
    this.prisma.assertConfigured();
    this.ensureDocumentHasReference(dto);
    const contractId = await this.resolveContractId(contractPublicId);

    try {
      const item = await this.prisma.contractDocument.create({
        data: {
          publicId: createPublicId('cdo'),
          contractId,
          title: dto.title.trim(),
          classification: dto.classification,
          fileName: dto.fileName?.trim() || null,
          mimeType: dto.mimeType?.trim() || null,
          externalLink: dto.externalLink?.trim() || null,
          physicalLocation: dto.physicalLocation?.trim() || null,
          notes: dto.notes?.trim() || null,
          status: ContractDocumentStatus.ACTIVE
        }
      });

      return this.mapContractDocument(item);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Contrato alvo do documento nao encontrado.'
      });
    }
  }

  async updateDocument(
    documentPublicId: string,
    dto: UpdateContractDocumentDto
  ) {
    this.prisma.assertConfigured();

    try {
      const item = await this.prisma.contractDocument.update({
        where: { publicId: documentPublicId },
        data: {
          title: dto.title?.trim(),
          classification: dto.classification,
          fileName:
            dto.fileName === undefined ? undefined : dto.fileName.trim() || null,
          mimeType:
            dto.mimeType === undefined ? undefined : dto.mimeType.trim() || null,
          externalLink:
            dto.externalLink === undefined
              ? undefined
              : dto.externalLink.trim() || null,
          physicalLocation:
            dto.physicalLocation === undefined
              ? undefined
              : dto.physicalLocation.trim() || null,
          notes: dto.notes === undefined ? undefined : dto.notes.trim() || null
        }
      });

      return this.mapContractDocument(item);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Documento do contrato nao encontrado.'
      });
    }
  }

  async removeDocument(documentPublicId: string) {
    this.prisma.assertConfigured();

    try {
      const item = await this.prisma.contractDocument.update({
        where: { publicId: documentPublicId },
        data: {
          status: ContractDocumentStatus.DELETED,
          deletedAt: new Date()
        }
      });

      return {
        publicId: item.publicId,
        status: item.status,
        deletedAt: item.deletedAt
      };
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Documento do contrato nao encontrado.'
      });
    }
  }

  private async resolveContractCatalog(
    contractTypePublicId?: string,
    contractModelPublicId?: string
  ) {
    const contractModel = contractModelPublicId
      ? await this.resolveActiveContractModel(contractModelPublicId)
      : null;
    const contractType = contractTypePublicId
      ? await this.resolveActiveContractType(contractTypePublicId)
      : contractModel?.contractType ?? (await this.ensureDefaultContractType());

    if (contractModel && contractModel.contractTypeId !== contractType.id) {
      throw new BadRequestException(
        'Modelo de contrato pertence a outro tipo de contrato.'
      );
    }

    return { contractType, contractModel };
  }

  private async ensureDefaultContractType() {
    const active = await this.prisma.contractType.findFirst({
      where: { status: ContractCatalogStatus.ACTIVE },
      orderBy: { createdAt: 'asc' }
    });

    if (active) {
      return active;
    }

    return this.prisma.contractType.upsert({
      where: { publicId: 'tco_seed_contratacao' },
      update: {
        status: ContractCatalogStatus.ACTIVE,
        description:
          'Tipo base para contratos de prestacao ou contratacao operacional.'
      },
      create: {
        publicId: 'tco_seed_contratacao',
        name: 'Contratacao',
        description:
          'Tipo base para contratos de prestacao ou contratacao operacional.',
        status: ContractCatalogStatus.ACTIVE
      }
    });
  }

  private async ensureAnotherActiveType(publicId: string) {
    const current = await this.prisma.contractType.findUnique({
      where: { publicId }
    });

    if (!current) {
      throw new NotFoundException('Tipo de contrato nao encontrado.');
    }

    const activeCount = await this.prisma.contractType.count({
      where: {
        status: ContractCatalogStatus.ACTIVE,
        publicId: { not: publicId }
      }
    });

    if (activeCount === 0 && current.status === ContractCatalogStatus.ACTIVE) {
      throw new BadRequestException(
        'Deve existir pelo menos um tipo de contrato ativo.'
      );
    }
  }

  private async resolveActiveContractType(publicId: string) {
    const item = await this.prisma.contractType.findFirst({
      where: {
        publicId,
        status: ContractCatalogStatus.ACTIVE
      }
    });

    if (!item) {
      throw new NotFoundException('Tipo de contrato ativo nao encontrado.');
    }

    return item;
  }

  private async resolveActiveContractModel(
    publicId: string
  ): Promise<ContractModelWithType> {
    const item = await this.prisma.contractModel.findFirst({
      where: {
        publicId,
        status: ContractCatalogStatus.ACTIVE
      },
      include: { contractType: true }
    });

    if (!item) {
      throw new NotFoundException('Modelo de contrato ativo nao encontrado.');
    }

    return item;
  }

  private async resolveContractId(publicId: string): Promise<bigint> {
    const contract = await this.prisma.contract.findUnique({
      where: { publicId },
      select: { id: true }
    });

    if (!contract) {
      throw new NotFoundException('Contrato nao encontrado.');
    }

    return contract.id;
  }

  private ensureDocumentHasReference(dto: CreateContractDocumentDto) {
    if (
      !dto.fileName?.trim() &&
      !dto.externalLink?.trim() &&
      !dto.physicalLocation?.trim()
    ) {
      throw new BadRequestException(
        'Informe arquivo, link externo ou local fisico do documento.'
      );
    }
  }

  private mapContract(item: ContractWithRelations) {
    return {
      publicId: item.publicId,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      status: item.status,
      notes: item.notes,
      contractType: item.contractType
        ? this.mapContractType(item.contractType)
        : null,
      contractModel: item.contractModel
        ? this.mapContractModel(item.contractModel)
        : null,
      documents: item.documents.map((document) =>
        this.mapContractDocument(document)
      ),
      positions: item.positions.map((position) => ({
        publicId: position.publicId,
        name: position.name,
        location: position.location,
        shift: position.shift,
        schedule: position.schedule,
        status: position.status,
        service: {
          publicId: position.service.publicId,
          name: position.service.name,
          category: position.service.category
        }
      })),
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

  private mapContractType(item: {
    publicId: string;
    name: string;
    description: string | null;
    status: ContractCatalogStatus;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      publicId: item.publicId,
      name: item.name,
      description: item.description,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }

  private mapContractModel(item: ContractModelWithType) {
    return {
      publicId: item.publicId,
      name: item.name,
      description: item.description,
      defaultSchedule: item.defaultSchedule,
      status: item.status,
      contractType: this.mapContractType(item.contractType),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }

  private mapContractDocument(item: {
    publicId: string;
    title: string;
    classification: string;
    fileName: string | null;
    mimeType: string | null;
    externalLink: string | null;
    physicalLocation: string | null;
    notes: string | null;
    status: ContractDocumentStatus;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      publicId: item.publicId,
      title: item.title,
      classification: item.classification,
      fileName: item.fileName,
      mimeType: item.mimeType,
      externalLink: item.externalLink,
      physicalLocation: item.physicalLocation,
      notes: item.notes,
      status: item.status,
      deletedAt: item.deletedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }
}
