import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { EmploymentLinkStatus, Prisma } from '@prisma/client';
import {
  tenantCreateRelation,
  tenantWhere
} from '../../common/tenant/tenant-scope';
import { buildPaginationArgs, buildPaginationMeta } from '../../common/utils/pagination';
import { rethrowPrismaError } from '../../common/utils/prisma-error';
import { createPublicId } from '../../common/utils/public-id';
import { PrismaService } from '../../infra/database/prisma.service';
import { AuthTokenPayload } from '../auth/interfaces/auth-token-payload.interface';
import { CreateDismissalDto } from './dto/create-dismissal.dto';
import { CreateEmploymentLinkDto } from './dto/create-employment-link.dto';
import { CreateEmploymentMoveDto } from './dto/create-employment-move.dto';
import { ListEmploymentLinksQueryDto } from './dto/list-employment-links-query.dto';

const employmentMoveInclude = {
  originPosition: true,
  destinationPosition: true,
  originContract: true,
  destinationContract: true
} satisfies Prisma.EmploymentMoveInclude;

type EmploymentLinkWithRelations = Prisma.EmploymentLinkGetPayload<{
  include: {
    person: true;
    providerCompany: true;
    contract: {
      include: {
        clientCompany: true;
        contractType: true;
        contractModel: true;
      };
    };
    position: {
      include: {
        service: true;
      };
    };
    moves: {
      include: typeof employmentMoveInclude;
    };
    dismissal: true;
  };
}>;

@Injectable()
export class EmploymentLinksService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: ListEmploymentLinksQueryDto, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    const { page, perPage, skip } = buildPaginationArgs(query);
    const where = tenantWhere(actor, this.buildListWhere(query));

    try {
      const [total, items] = await Promise.all([
        this.prisma.employmentLink.count({ where }),
        this.prisma.employmentLink.findMany({
          where,
          skip,
          take: perPage,
          orderBy: [
            { startsAt: 'desc' },
            { id: 'desc' }
          ],
          include: {
            person: true,
            providerCompany: true,
            contract: {
              include: {
                clientCompany: true,
                contractType: true,
                contractModel: true
              }
            },
            position: {
              include: {
                service: true
              }
            },
            moves: {
              orderBy: [
                { movedAt: 'desc' },
                { id: 'desc' }
              ],
              include: employmentMoveInclude
            },
            dismissal: true
          }
        })
      ]);

      return {
        items: items.map((item) => this.mapEmploymentLink(item)),
        pagination: buildPaginationMeta(page, perPage, total)
      };
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async findOne(publicId: string, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    try {
      const item = await this.loadEmploymentLink(publicId, actor);

      if (!item) {
        throw new NotFoundException('Vinculo nao encontrado.');
      }

      return this.mapEmploymentLink(item);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Vinculo nao encontrado.'
      });
    }
  }

  async create(dto: CreateEmploymentLinkDto, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    const startsAt = new Date(dto.startsAt);
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;

    if (endsAt && endsAt < startsAt) {
      throw new BadRequestException(
        'A data final do vinculo nao pode ser anterior a data inicial.'
      );
    }

    try {
      const [person, providerCompany, contract, position] = await Promise.all([
        this.prisma.person.findFirst({
          where: tenantWhere(actor, { publicId: dto.personPublicId })
        }),
        this.prisma.providerCompany.findFirst({
          where: tenantWhere(actor, {
            publicId: dto.providerCompanyPublicId
          })
        }),
        this.prisma.contract.findFirst({
          where: tenantWhere(actor, { publicId: dto.contractPublicId })
        }),
        this.prisma.position.findFirst({
          where: tenantWhere(actor, { publicId: dto.positionPublicId }),
          include: {
            service: true
          }
        })
      ]);

      if (!person) {
        throw new NotFoundException('Pessoa informada nao encontrada.');
      }

      if (!providerCompany) {
        throw new NotFoundException('Empresa prestadora informada nao encontrada.');
      }

      if (!contract) {
        throw new NotFoundException('Contrato informado nao encontrado.');
      }

      if (!position) {
        throw new NotFoundException('Posto informado nao encontrado.');
      }

      if (contract.providerCompanyId !== providerCompany.id) {
        throw new BadRequestException(
          'O contrato informado nao pertence a empresa prestadora selecionada.'
        );
      }

      if (position.contractId !== contract.id) {
        throw new BadRequestException(
          'O posto informado nao pertence ao contrato selecionado.'
        );
      }

      const item = await this.prisma.employmentLink.create({
        data: {
          publicId: createPublicId('vin'),
          tenantRootCompany: tenantCreateRelation(actor),
          person: { connect: { id: person.id } },
          providerCompany: { connect: { id: providerCompany.id } },
          contract: { connect: { id: contract.id } },
          position: { connect: { id: position.id } },
          type: dto.type,
          status: dto.status ?? EmploymentLinkStatus.PENDING,
          startsAt,
          endsAt
        }
      });

      const hydrated = await this.loadEmploymentLink(item.publicId, actor);

      if (!hydrated) {
        throw new NotFoundException('Vinculo nao encontrado apos a criacao.');
      }

      return this.mapEmploymentLink(hydrated);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Pessoa, empresa prestadora, contrato ou posto nao encontrado.'
      });
    }
  }

  async createMove(
    publicId: string,
    dto: CreateEmploymentMoveDto,
    actor: AuthTokenPayload
  ) {
    this.prisma.assertConfigured();

    const link = await this.loadEmploymentLink(publicId, actor);

    if (!link) {
      throw new NotFoundException('Vinculo nao encontrado.');
    }

    if (link.status === EmploymentLinkStatus.DISMISSED || link.dismissal) {
      throw new BadRequestException(
        'Nao e possivel registrar movimentacao em um vinculo desligado.'
      );
    }

    const structuredRefs = await this.resolveMoveStructuredRefs(dto, actor);

    try {
      await this.prisma.employmentMove.create({
        data: {
          publicId: createPublicId('mov'),
          employmentLinkId: link.id,
          moveType: dto.moveType,
          origin: dto.origin ?? null,
          destination: dto.destination ?? null,
          originPositionId: structuredRefs.originPositionId,
          destinationPositionId: structuredRefs.destinationPositionId,
          originContractId: structuredRefs.originContractId,
          destinationContractId: structuredRefs.destinationContractId,
          movedAt: new Date(dto.movedAt),
          notes: dto.notes ?? null
        }
      });

      const hydrated = await this.loadEmploymentLink(publicId, actor);

      if (!hydrated) {
        throw new NotFoundException('Vinculo nao encontrado apos a movimentacao.');
      }

      return this.mapEmploymentLink(hydrated);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Vinculo nao encontrado.'
      });
    }
  }

  async registerDismissal(
    publicId: string,
    dto: CreateDismissalDto,
    actor: AuthTokenPayload
  ) {
    this.prisma.assertConfigured();

    const link = await this.loadEmploymentLink(publicId, actor);

    if (!link) {
      throw new NotFoundException('Vinculo nao encontrado.');
    }

    if (link.dismissal) {
      throw new ConflictException(
        'Ja existe desligamento registrado para este vinculo.'
      );
    }

    const dismissedAt = new Date(dto.dismissedAt);

    if (dismissedAt < link.startsAt) {
      throw new BadRequestException(
        'A data de desligamento nao pode ser anterior ao inicio do vinculo.'
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.dismissal.create({
          data: {
            publicId: createPublicId('dsl'),
            employmentLinkId: link.id,
            dismissedAt,
            reason: dto.reason,
            dismissalType: dto.dismissalType ?? null,
            riskSummary: dto.riskSummary ?? null,
            pendingIssues: dto.pendingIssues ?? null,
            legalNotes: dto.legalNotes ?? null
          }
        });

        await tx.employmentLink.update({
          where: { id: link.id },
          data: {
            status: EmploymentLinkStatus.DISMISSED,
            endsAt: link.endsAt ?? dismissedAt
          }
        });

        // O desligamento sempre deixa um evento cronologico explicito para
        // relatorios e dossie futuro sem exigir regra derivada no front.
        await tx.employmentMove.create({
          data: {
            publicId: createPublicId('mov'),
            employmentLinkId: link.id,
            moveType: 'DESLIGAMENTO',
            origin: link.position.name,
            destination: 'DESLIGADO',
            originPositionId: link.positionId,
            originContractId: link.contractId,
            movedAt: dismissedAt,
            notes: dto.reason
          }
        });
      });

      const hydrated = await this.loadEmploymentLink(publicId, actor);

      if (!hydrated) {
        throw new NotFoundException('Vinculo nao encontrado apos o desligamento.');
      }

      return this.mapEmploymentLink(hydrated);
    } catch (error) {
      rethrowPrismaError(error, {
        duplicate: 'Ja existe desligamento registrado para este vinculo.',
        notFound: 'Vinculo nao encontrado.'
      });
    }
  }

  private buildListWhere(
    query: ListEmploymentLinksQueryDto
  ): Prisma.EmploymentLinkWhereInput | undefined {
    const filters: Prisma.EmploymentLinkWhereInput[] = [];
    const search = query.search?.trim();

    if (search) {
      filters.push({
        OR: [
          { type: { contains: search } },
          { person: { is: { name: { contains: search } } } },
          { person: { is: { cpf: { contains: search } } } },
          { providerCompany: { is: { legalName: { contains: search } } } },
          { providerCompany: { is: { tradeName: { contains: search } } } },
          { contract: { is: { clientCompany: { is: { name: { contains: search } } } } } },
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

    if (query.contractPublicId) {
      filters.push({
        contract: {
          is: {
            publicId: query.contractPublicId
          }
        }
      });
    }

    if (query.status) {
      filters.push({
        status: query.status
      });
    }

    if (query.type) {
      filters.push({
        type: {
          equals: query.type
        }
      });
    }

    if (filters.length === 0) {
      return undefined;
    }

    return {
      AND: filters
    };
  }

  private async resolveMoveStructuredRefs(
    dto: CreateEmploymentMoveDto,
    actor: AuthTokenPayload
  ) {
    const [
      originPosition,
      destinationPosition,
      explicitOriginContract,
      explicitDestinationContract
    ] = await Promise.all([
      this.findScopedPosition(dto.originPositionPublicId, actor),
      this.findScopedPosition(dto.destinationPositionPublicId, actor),
      this.findScopedContract(dto.originContractPublicId, actor),
      this.findScopedContract(dto.destinationContractPublicId, actor)
    ]);

    if (dto.originPositionPublicId && !originPosition) {
      throw new BadRequestException(
        'Posto de origem da movimentacao nao encontrado.'
      );
    }

    if (dto.destinationPositionPublicId && !destinationPosition) {
      throw new BadRequestException(
        'Posto de destino da movimentacao nao encontrado.'
      );
    }

    if (dto.originContractPublicId && !explicitOriginContract) {
      throw new BadRequestException(
        'Contrato de origem da movimentacao nao encontrado.'
      );
    }

    if (dto.destinationContractPublicId && !explicitDestinationContract) {
      throw new BadRequestException(
        'Contrato de destino da movimentacao nao encontrado.'
      );
    }

    if (
      originPosition &&
      explicitOriginContract &&
      originPosition.contractId !== explicitOriginContract.id
    ) {
      throw new BadRequestException(
        'Posto de origem nao pertence ao contrato de origem informado.'
      );
    }

    if (
      destinationPosition &&
      explicitDestinationContract &&
      destinationPosition.contractId !== explicitDestinationContract.id
    ) {
      throw new BadRequestException(
        'Posto de destino nao pertence ao contrato de destino informado.'
      );
    }

    return {
      originPositionId: originPosition?.id,
      destinationPositionId: destinationPosition?.id,
      originContractId: explicitOriginContract?.id ?? originPosition?.contractId,
      destinationContractId:
        explicitDestinationContract?.id ?? destinationPosition?.contractId
    };
  }

  private async findScopedPosition(
    publicId: string | undefined,
    actor: AuthTokenPayload
  ) {
    const normalized = publicId?.trim();
    if (!normalized) {
      return null;
    }

    return this.prisma.position.findFirst({
      where: tenantWhere(actor, { publicId: normalized })
    });
  }

  private async findScopedContract(
    publicId: string | undefined,
    actor: AuthTokenPayload
  ) {
    const normalized = publicId?.trim();
    if (!normalized) {
      return null;
    }

    return this.prisma.contract.findFirst({
      where: tenantWhere(actor, { publicId: normalized })
    });
  }

  private async loadEmploymentLink(
    publicId: string,
    actor: AuthTokenPayload
  ) {
    return this.prisma.employmentLink.findFirst({
      where: tenantWhere(actor, { publicId }),
      include: {
        person: true,
        providerCompany: true,
        contract: {
          include: {
            clientCompany: true,
            contractType: true,
            contractModel: true
          }
        },
        position: {
          include: {
            service: true
          }
        },
        moves: {
          orderBy: [
            { movedAt: 'desc' },
            { id: 'desc' }
          ],
          include: employmentMoveInclude
        },
        dismissal: true
      }
    });
  }

  private mapEmploymentLink(item: EmploymentLinkWithRelations) {
    // O front recebe o vinculo ja hidratado com pessoa, contrato, posto e
    // historico imediato para evitar consultas em cascata a cada detalhe.
    return {
      publicId: item.publicId,
      type: item.type,
      status: item.status,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      person: {
        publicId: item.person.publicId,
        name: item.person.name,
        cpf: item.person.cpf,
        email: item.person.email,
        phone: item.person.phone
      },
      providerCompany: {
        publicId: item.providerCompany.publicId,
        legalName: item.providerCompany.legalName,
        tradeName: item.providerCompany.tradeName,
        document: item.providerCompany.document
      },
      contract: {
        publicId: item.contract.publicId,
        status: item.contract.status,
        startsAt: item.contract.startsAt,
        endsAt: item.contract.endsAt,
        contractType: item.contract.contractType
          ? {
              publicId: item.contract.contractType.publicId,
              name: item.contract.contractType.name,
              description: item.contract.contractType.description,
              status: item.contract.contractType.status
            }
          : null,
        contractModel: item.contract.contractModel
          ? {
              publicId: item.contract.contractModel.publicId,
              name: item.contract.contractModel.name,
              description: item.contract.contractModel.description,
              defaultSchedule: item.contract.contractModel.defaultSchedule,
              status: item.contract.contractModel.status
            }
          : null,
        clientCompany: {
          publicId: item.contract.clientCompany.publicId,
          name: item.contract.clientCompany.name,
          clientType: item.contract.clientCompany.clientType
        }
      },
      position: {
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
      },
      moves: item.moves.map((move) => ({
        publicId: move.publicId,
        moveType: move.moveType,
        origin: move.origin,
        destination: move.destination,
        originPositionPublicId: move.originPosition?.publicId ?? null,
        destinationPositionPublicId: move.destinationPosition?.publicId ?? null,
        originContractPublicId: move.originContract?.publicId ?? null,
        destinationContractPublicId: move.destinationContract?.publicId ?? null,
        movedAt: move.movedAt,
        notes: move.notes
      })),
      dismissal: item.dismissal
        ? {
            publicId: item.dismissal.publicId,
            dismissedAt: item.dismissal.dismissedAt,
            reason: item.dismissal.reason,
            dismissalType: item.dismissal.dismissalType,
            riskSummary: item.dismissal.riskSummary,
            pendingIssues: item.dismissal.pendingIssues,
            legalNotes: item.dismissal.legalNotes
          }
        : null
    };
  }
}
