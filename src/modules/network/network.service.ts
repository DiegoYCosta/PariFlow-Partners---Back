import { Inject, Injectable } from '@nestjs/common';
import { EmploymentLinkStatus, Prisma } from '@prisma/client';
import { rethrowPrismaError } from '../../common/utils/prisma-error';
import { PrismaService } from '../../infra/database/prisma.service';
import { NetworkGraphQueryDto } from './dto/network-graph-query.dto';

const graphContractInclude = {
  providerCompany: true,
  clientCompany: true,
  links: {
    orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
    include: {
      person: true,
      dismissal: true
    }
  },
  positions: {
    include: {
      service: true,
      links: {
        orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
        include: {
          person: true,
          dismissal: true
        }
      }
    }
  }
} satisfies Prisma.ContractInclude;

type GraphContract = Prisma.ContractGetPayload<{
  include: typeof graphContractInclude;
}>;

type GraphNode = {
  publicId: string;
  nodeType: string;
  lane: string;
  displayName: string;
  subtitle: string;
  status: string;
  badges: string[];
  detailSnapshot: Record<string, unknown>;
};

type GraphEdge = {
  publicId: string;
  fromPublicId: string;
  toPublicId: string;
  relationshipKind: string;
  relationshipState: string;
  periodStart: string | null;
  periodEnd: string | null;
  metadata: Record<string, string>;
};

type GraphPeriod = {
  preset: string;
  from: Date;
  to: Date;
};

type NormalizedNetworkGraphQuery = Omit<
  NetworkGraphQueryDto,
  'contractStatuses' | 'employeeStatuses' | 'includeHistorical' | 'includeIndirect'
> & {
  contractStatuses?: string[];
  employeeStatuses?: string[];
  includeHistorical: boolean;
  includeIndirect: boolean;
};

@Injectable()
export class NetworkService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async graph(query: NetworkGraphQueryDto) {
    this.prisma.assertConfigured();

    const period = this.resolvePeriod(query.periodPreset);
    const normalizedQuery = this.normalizeQuery(query);
    const where = this.buildContractWhere(normalizedQuery, period);

    try {
      const contracts = await this.prisma.contract.findMany({
        where,
        take: 120,
        orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
        include: graphContractInclude
      });

      return this.buildGraph(contracts, normalizedQuery, period);
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  private buildContractWhere(
    query: NormalizedNetworkGraphQuery,
    period: GraphPeriod
  ): Prisma.ContractWhereInput {
    const filters: Prisma.ContractWhereInput[] = [];
    const search = query.search?.trim();

    if (search) {
      filters.push({
        OR: [
          { status: { contains: search } },
          { notes: { contains: search } },
          { providerCompany: { is: { legalName: { contains: search } } } },
          { providerCompany: { is: { tradeName: { contains: search } } } },
          { clientCompany: { is: { name: { contains: search } } } },
          { positions: { some: { name: { contains: search } } } },
          { links: { some: { person: { is: { name: { contains: search } } } } } },
          { links: { some: { person: { is: { cpf: { contains: search } } } } } }
        ]
      });
    }

    if (query.rootCompanyPublicIds?.length) {
      filters.push({
        providerCompany: {
          is: {
            publicId: {
              in: query.rootCompanyPublicIds
            }
          }
        }
      });
    }

    if (query.clientCompanyPublicIds?.length) {
      filters.push({
        clientCompany: {
          is: {
            publicId: {
              in: query.clientCompanyPublicIds
            }
          }
        }
      });
    }

    if (query.contractStatuses?.length) {
      filters.push({
        OR: query.contractStatuses.map((status) =>
          this.contractStatusWhere(status)
        )
      });
    }

    if (!query.includeHistorical) {
      filters.push({
        OR: [
          { status: { equals: 'ACTIVE' } },
          {
            AND: [
              { startsAt: { lte: period.to } },
              { OR: [{ endsAt: null }, { endsAt: { gte: period.to } }] }
            ]
          }
        ]
      });
    } else if (period.preset !== 'all') {
      filters.push({
        AND: [
          { startsAt: { lte: period.to } },
          { OR: [{ endsAt: null }, { endsAt: { gte: period.from } }] }
        ]
      });
    }

    return filters.length ? { AND: filters } : {};
  }

  private buildGraph(
    contracts: GraphContract[],
    query: NormalizedNetworkGraphQuery,
    period: GraphPeriod
  ) {
    const nodes = new Map<string, GraphNode>();
    const edges = new Map<string, GraphEdge>();
    const contractStatuses = new Set<string>();
    const employeeStatuses = new Set<string>();

    const addNode = (node: GraphNode) => {
      if (!nodes.has(node.publicId)) {
        nodes.set(node.publicId, node);
      }
    };

    const addEdge = (edge: GraphEdge) => {
      if (!edges.has(edge.publicId)) {
        edges.set(edge.publicId, edge);
      }
    };

    for (const contract of contracts) {
      const provider = contract.providerCompany;
      const client = contract.clientCompany;
      const contractStatus = this.contractGraphStatus(contract);
      const contractRelationshipState =
        contractStatus === 'active' ? 'active' : 'historical';

      contractStatuses.add(contractStatus);

      addNode({
        publicId: provider.publicId,
        nodeType: 'root_company',
        lane: 'root_company',
        displayName: provider.tradeName ?? provider.legalName,
        subtitle: 'Empresa prestadora',
        status: this.normalizedStatus(provider.status),
        badges: ['prestadora', provider.document],
        detailSnapshot: {
          kind: 'root_company',
          summary: `Prestadora ${provider.legalName} no recorte relacional atual.`,
          activeContracts: contracts.filter(
            (item) =>
              item.providerCompanyId === provider.id &&
              this.contractGraphStatus(item) === 'active'
          ).length,
          activeEmployees: this.countActiveEmployeesForProvider(
            contracts,
            provider.id
          ),
          cta: {
            label: 'Abrir prestadora',
            targetPublicId: provider.publicId
          }
        }
      });

      addNode({
        publicId: client.publicId,
        nodeType: 'client_company',
        lane: 'client_company',
        displayName: client.name,
        subtitle: client.clientType,
        status: this.normalizedStatus(client.status),
        badges: ['cliente', client.document ?? 'sem documento'],
        detailSnapshot: {
          kind: 'client_company',
          summary: `Cliente ${client.name} conectado a contratos visiveis no recorte.`,
          rootCompanies: [provider.tradeName ?? provider.legalName],
          activeContracts: contracts.filter(
            (item) =>
              item.clientCompanyId === client.id &&
              this.contractGraphStatus(item) === 'active'
          ).length,
          cta: {
            label: 'Abrir cliente',
            targetPublicId: client.publicId
          }
        }
      });

      addNode({
        publicId: contract.publicId,
        nodeType: 'contract',
        lane: 'contract',
        displayName: `${provider.tradeName ?? provider.legalName} -> ${client.name}`,
        subtitle: contract.status,
        status: contractStatus,
        badges: [
          `${contract.positions.length} postos`,
          `${contract.links.length} vinculos`
        ],
        detailSnapshot: {
          kind: 'contract',
          summary: `Contrato entre ${provider.legalName} e ${client.name}.`,
          contractStatus,
          clientCompanies: [client.name],
          activeEmployees: contract.links.filter((link) =>
            this.isActiveLink(link)
          ).length,
          historicalEmployees: contract.links.filter(
            (link) => !this.isActiveLink(link)
          ).length,
          cta: {
            label: 'Abrir contrato',
            targetPublicId: contract.publicId
          }
        }
      });

      addEdge({
        publicId: `edge_${provider.publicId}_${client.publicId}_${contract.publicId}`,
        fromPublicId: provider.publicId,
        toPublicId: client.publicId,
        relationshipKind: 'provider_client_scope',
        relationshipState: contractRelationshipState,
        periodStart: this.dateLabel(contract.startsAt),
        periodEnd: this.dateLabel(contract.endsAt),
        metadata: {
          label: contract.status
        }
      });

      addEdge({
        publicId: `edge_${client.publicId}_${contract.publicId}`,
        fromPublicId: client.publicId,
        toPublicId: contract.publicId,
        relationshipKind: 'contract_allocation',
        relationshipState: contractRelationshipState,
        periodStart: this.dateLabel(contract.startsAt),
        periodEnd: this.dateLabel(contract.endsAt),
        metadata: {
          label: contract.status
        }
      });

      for (const position of contract.positions) {
        addNode({
          publicId: position.publicId,
          nodeType: 'position',
          lane: 'position',
          displayName: position.name,
          subtitle: position.location ?? position.shift ?? 'Posto',
          status: this.normalizedStatus(position.status),
          badges: [
            contract.status,
            position.service.name,
            `${position.links.length} vinculos`
          ],
          detailSnapshot: {
            kind: 'position',
            summary: `Posto ${position.name} no contrato ${contract.publicId}.`,
            contractStatus,
            clientCompanies: [client.name],
            activeEmployees: position.links.filter((link) =>
              this.isActiveLink(link)
            ).length,
            historicalEmployees: position.links.filter(
              (link) => !this.isActiveLink(link)
            ).length,
            cta: {
              label: 'Abrir posto',
              targetPublicId: position.publicId
            },
            contract: contract.publicId,
            service: position.service.name,
            shift: position.shift,
            schedule: position.schedule,
            location: position.location,
            statusLabel: position.status
          }
        });

        addEdge({
          publicId: `edge_${contract.publicId}_${position.publicId}`,
          fromPublicId: contract.publicId,
          toPublicId: position.publicId,
          relationshipKind: 'position_scope',
          relationshipState: contractRelationshipState,
          periodStart: this.dateLabel(contract.startsAt),
          periodEnd: this.dateLabel(contract.endsAt),
          metadata: {
            label: position.service.name
          }
        });

        for (const link of position.links) {
          const employeeStatus = this.employmentStatus(link);

          if (!this.shouldIncludeEmploymentLink(link, query, period)) {
            continue;
          }

          employeeStatuses.add(employeeStatus);

          addNode({
            publicId: link.person.publicId,
            nodeType: 'employee',
            lane: 'employee',
            displayName: link.person.name,
            subtitle: position.name,
            status: employeeStatus,
            badges: [link.type, provider.tradeName ?? provider.legalName],
            detailSnapshot: {
              kind: 'employee',
              summary: `${link.person.name} em ${position.name}.`,
              activeContracts: this.isActiveLink(link) ? 1 : 0,
              historicalContracts: this.isActiveLink(link) ? 0 : 1,
              cta: {
                label: 'Abrir pessoa',
                targetPublicId: link.person.publicId
              },
              email: link.person.email,
              phone: link.person.phone,
              cpf: link.person.cpf,
              clientCompany: client.name,
              contract: contract.publicId,
              providerCompany: provider.tradeName ?? provider.legalName,
              statusLabel: link.status,
              startDate: this.dateLabel(link.startsAt),
              endDate: this.dateLabel(link.endsAt ?? link.dismissal?.dismissedAt),
              location: position.location
            }
          });

          addEdge({
            publicId: `edge_${position.publicId}_${link.person.publicId}_${link.publicId}`,
            fromPublicId: position.publicId,
            toPublicId: link.person.publicId,
            relationshipKind: 'employment_link',
            relationshipState: this.isActiveLink(link) ? 'active' : 'historical',
            periodStart: this.dateLabel(link.startsAt),
            periodEnd: this.dateLabel(link.endsAt ?? link.dismissal?.dismissedAt),
            metadata: {
              label: link.status
            }
          });
        }
      }
    }

    const filteredEdges = Array.from(edges.values()).filter(
      (edge) => nodes.has(edge.fromPublicId) && nodes.has(edge.toPublicId)
    );
    const nodeItems = Array.from(nodes.values());
    const focusPublicId =
      query.focusPublicId && nodes.has(query.focusPublicId)
        ? query.focusPublicId
        : nodeItems.find((node) => node.lane === 'employee')?.publicId ??
          nodeItems[0]?.publicId ??
          null;

    return {
      period: {
        preset: period.preset,
        from: this.dateLabel(period.from),
        to: this.dateLabel(period.to)
      },
      lanes: [
        'root_company',
        'client_company',
        'contract',
        'position',
        'employee'
      ],
      nodes: nodeItems,
      edges: filteredEdges,
      filters: {
        search: query.search ?? '',
        applied: {
          periodPreset: period.preset,
          rootCompanyPublicIds: query.rootCompanyPublicIds ?? [],
          clientCompanyPublicIds: query.clientCompanyPublicIds ?? [],
          contractStatuses:
            query.contractStatuses ?? Array.from(contractStatuses).sort(),
          employeeStatuses:
            query.employeeStatuses ?? Array.from(employeeStatuses).sort(),
          includeHistorical: query.includeHistorical,
          includeIndirect: query.includeIndirect
        },
        available: {
          periodPresets: ['6m', '1y', '2y', 'all'],
          rootCompanies: this.optionsForLane(nodeItems, 'root_company'),
          clientCompanies: this.optionsForLane(nodeItems, 'client_company'),
          contractStatuses: Array.from(contractStatuses).sort(),
          employeeStatuses: Array.from(employeeStatuses).sort(),
          relationshipStates: ['active', 'historical', 'indirect']
        }
      },
      legend: {
        relationshipStates: [
          { value: 'active', label: 'Relacao ativa' },
          { value: 'historical', label: 'Relacao historica' },
          { value: 'indirect', label: 'Relacao indireta' }
        ]
      },
      focus: {
        selectedNodePublicId: focusPublicId,
        hoveredNodePublicId: null,
        viewportAnchorPublicId: focusPublicId
      }
    };
  }

  private normalizeQuery(query: NetworkGraphQueryDto) {
    return {
      ...query,
      contractStatuses: query.contractStatuses?.map((item) =>
        this.normalizedStatus(item)
      ),
      employeeStatuses: query.employeeStatuses?.map((item) =>
        this.normalizedStatus(item)
      ),
      includeHistorical: query.includeHistorical ?? true,
      includeIndirect: query.includeIndirect ?? false
    };
  }

  private resolvePeriod(preset = '1y'): GraphPeriod {
    const to = new Date();
    const from = new Date(to);

    switch (preset) {
      case '6m':
        from.setMonth(from.getMonth() - 6);
        break;
      case '2y':
        from.setFullYear(from.getFullYear() - 2);
        break;
      case 'all':
        from.setFullYear(1970, 0, 1);
        break;
      case '1y':
      default:
        from.setFullYear(from.getFullYear() - 1);
        preset = '1y';
        break;
    }

    return { preset, from, to };
  }

  private contractStatusWhere(status: string): Prisma.ContractWhereInput {
    const normalized = this.normalizedStatus(status);
    const now = new Date();

    if (normalized === 'active') {
      return {
        OR: [
          { status: { equals: 'ACTIVE' } },
          { AND: [{ startsAt: { lte: now } }, { endsAt: null }] },
          { AND: [{ startsAt: { lte: now } }, { endsAt: { gte: now } }] }
        ]
      };
    }

    if (normalized === 'expired' || normalized === 'historical') {
      return {
        OR: [
          { status: { equals: 'EXPIRED' } },
          { endsAt: { lt: now } }
        ]
      };
    }

    return {
      status: {
        equals: status.toUpperCase()
      }
    };
  }

  private shouldIncludeEmploymentLink(
    link: GraphContract['positions'][number]['links'][number],
    query: NormalizedNetworkGraphQuery,
    period: GraphPeriod
  ): boolean {
    const status = this.employmentStatus(link);

    if (query.employeeStatuses?.length && !query.employeeStatuses.includes(status)) {
      return false;
    }

    if (!query.includeHistorical && !this.isActiveLink(link)) {
      return false;
    }

    if (period.preset === 'all') {
      return true;
    }

    const end = link.endsAt ?? link.dismissal?.dismissedAt;
    return link.startsAt <= period.to && (!end || end >= period.from);
  }

  private contractGraphStatus(contract: GraphContract): string {
    const rawStatus = this.normalizedStatus(contract.status);
    const now = new Date();

    if (rawStatus === 'active' && (!contract.endsAt || contract.endsAt >= now)) {
      return 'active';
    }

    if (contract.endsAt && contract.endsAt < now) {
      return 'expired';
    }

    return rawStatus || 'active';
  }

  private employmentStatus(
    link: GraphContract['positions'][number]['links'][number]
  ): string {
    if (link.status === EmploymentLinkStatus.ACTIVE && !link.endsAt) {
      return 'active';
    }

    if (link.status === EmploymentLinkStatus.DISMISSED || link.dismissal) {
      return 'dismissed';
    }

    return this.normalizedStatus(link.status);
  }

  private isActiveLink(
    link: GraphContract['positions'][number]['links'][number]
  ): boolean {
    return link.status === EmploymentLinkStatus.ACTIVE && !link.endsAt && !link.dismissal;
  }

  private countActiveEmployeesForProvider(
    contracts: GraphContract[],
    providerCompanyId: bigint
  ): number {
    const people = new Set<string>();

    for (const contract of contracts) {
      if (contract.providerCompanyId !== providerCompanyId) {
        continue;
      }

      for (const position of contract.positions) {
        for (const link of position.links) {
          if (this.isActiveLink(link)) {
            people.add(link.person.publicId);
          }
        }
      }
    }

    return people.size;
  }

  private normalizedStatus(value?: string | null): string {
    return (value ?? '')
      .trim()
      .toLowerCase()
      .replaceAll('_', '-');
  }

  private dateLabel(value?: Date | null): string | null {
    return value ? value.toISOString().slice(0, 10) : null;
  }

  private optionsForLane(nodes: GraphNode[], lane: string) {
    return nodes
      .filter((node) => node.lane === lane)
      .map((node) => ({
        publicId: node.publicId,
        label: node.displayName
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }
}
