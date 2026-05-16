import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { EmploymentLinkStatus, Prisma } from '@prisma/client';
import { tenantWhere } from '../../common/tenant/tenant-scope';
import { rethrowPrismaError } from '../../common/utils/prisma-error';
import { PrismaService } from '../../infra/database/prisma.service';
import { AuthTokenPayload } from '../auth/interfaces/auth-token-payload.interface';
import { NetworkGraphQueryDto } from './dto/network-graph-query.dto';
import {
  NETWORK_TIMELINE_PERIOD_PRESETS,
  NetworkTimelineQueryDto
} from './dto/network-timeline-query.dto';

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

const timelineContractInclude = {
  providerCompany: true,
  clientCompany: true,
  positions: {
    orderBy: [{ id: 'asc' }],
    include: {
      service: true,
      links: {
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        include: {
          person: true,
          dismissal: true,
          moves: {
            orderBy: [{ movedAt: 'asc' }, { id: 'asc' }]
          }
        }
      }
    }
  }
} satisfies Prisma.ContractInclude;

const timelineRecordInclude = {
  links: {
    orderBy: [{ entityType: 'asc' }, { id: 'asc' }]
  }
} satisfies Prisma.TimelineRecordInclude;

const timelineCalendarEntryInclude = {
  person: true,
  providerCompany: true,
  clientCompany: true,
  contract: {
    include: {
      providerCompany: true,
      clientCompany: true
    }
  },
  employmentLink: {
    include: {
      person: true,
      providerCompany: true,
      contract: {
        include: {
          providerCompany: true,
          clientCompany: true
        }
      },
      position: true
    }
  },
  position: true
} satisfies Prisma.CalendarEntryInclude;

type GraphContract = Prisma.ContractGetPayload<{
  include: typeof graphContractInclude;
}>;

type TimelineContract = Prisma.ContractGetPayload<{
  include: typeof timelineContractInclude;
}>;

type TimelineRecord = Prisma.TimelineRecordGetPayload<{
  include: typeof timelineRecordInclude;
}>;

type TimelineCalendarEntry = Prisma.CalendarEntryGetPayload<{
  include: typeof timelineCalendarEntryInclude;
}>;

type GraphEmploymentLink = GraphContract['positions'][number]['links'][number];
type TimelineEmploymentLink =
  TimelineContract['positions'][number]['links'][number];
type NetworkEmploymentLink = GraphEmploymentLink | TimelineEmploymentLink;

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

type NormalizedNetworkTimelineQuery = Omit<
  NetworkTimelineQueryDto,
  | 'contractStatuses'
  | 'employeeStatuses'
  | 'includeHistorical'
  | 'includeMoves'
  | 'includeOperationalEvents'
> & {
  contractStatuses?: string[];
  employeeStatuses?: string[];
  includeHistorical: boolean;
  includeMoves: boolean;
  includeOperationalEvents: boolean;
};

type TimelineAllocation = {
  employmentLinkPublicId: string;
  personPublicId: string;
  personName: string;
  providerCompanyPublicId: string;
  contractPublicId: string;
  positionPublicId: string;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
  type: string;
};

type TimelineEvent = {
  publicId: string;
  eventType: string;
  source: string;
  occurredAt: string | null;
  personPublicId?: string;
  employmentLinkPublicId?: string;
  positionPublicId?: string | null;
  originPositionPublicId?: string | null;
  destinationPositionPublicId?: string | null;
  originLabel?: string | null;
  destinationLabel?: string | null;
  label: string;
  notes: string | null;
  linkedEntities?: Array<{
    entityType: string;
    entityPublicId: string | null;
    labelSnapshot: string;
  }>;
};

type TimelineWarning = {
  code: string;
  severity: 'warning';
  entityPublicId: string;
  message: string;
};

type TimelineCollaboratorAccumulator = {
  personPublicId: string;
  personName: string;
  statuses: Set<string>;
  segments: Array<{
    kind: 'allocation';
    employmentLinkPublicId: string;
    contractPublicId: string;
    positionPublicId: string;
    startsAt: string | null;
    endsAt: string | null;
    status: string;
  }>;
  events: TimelineEvent[];
};

type TimelineEntityScope = {
  providerCompanyPublicIds: Set<string>;
  clientCompanyPublicIds: Set<string>;
  contractPublicIds: Set<string>;
  positionPublicIds: Set<string>;
  employmentLinkPublicIds: Set<string>;
  personPublicIds: Set<string>;
  allPublicIds: Set<string>;
};

@Injectable()
export class NetworkService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async timeline(query: NetworkTimelineQueryDto, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    const period = this.resolveTimelinePeriod(query);
    const normalizedQuery = this.normalizeTimelineQuery(query);
    const where = tenantWhere(
      actor,
      this.buildTimelineContractWhere(normalizedQuery, period)
    );

    try {
      const contracts = await this.prisma.contract.findMany({
        where,
        take: 120,
        orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
        include: timelineContractInclude
      });
      const entityScope = this.buildTimelineEntityScope(
        contracts,
        normalizedQuery,
        period
      );
      const [timelineRecords, calendarEntries] =
        normalizedQuery.includeOperationalEvents
          ? await Promise.all([
              this.prisma.timelineRecord.findMany({
                where: tenantWhere(
                  actor,
                  this.buildTimelineRecordWhere(normalizedQuery, period, entityScope)
                ),
                take: 80,
                orderBy: [
                  { eventDate: 'desc' },
                  { referenceMonth: 'desc' },
                  { id: 'desc' }
                ],
                include: timelineRecordInclude
              }),
              this.prisma.calendarEntry.findMany({
                where: tenantWhere(
                  actor,
                  this.buildTimelineCalendarWhere(
                    normalizedQuery,
                    period,
                    entityScope
                  )
                ),
                take: 80,
                orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
                include: timelineCalendarEntryInclude
              })
            ])
          : [[], []];

      return this.buildTimeline(
        contracts,
        timelineRecords,
        calendarEntries,
        normalizedQuery,
        period
      );
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async graph(query: NetworkGraphQueryDto, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    const period = this.resolvePeriod(query.periodPreset);
    const normalizedQuery = this.normalizeQuery(query);
    const where = tenantWhere(
      actor,
      this.buildContractWhere(normalizedQuery, period)
    );

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

  private buildTimeline(
    contracts: TimelineContract[],
    timelineRecords: TimelineRecord[],
    calendarEntries: TimelineCalendarEntry[],
    query: NormalizedNetworkTimelineQuery,
    period: GraphPeriod
  ) {
    const periodFrom = this.dateLabel(period.from);
    const periodTo = this.dateLabel(period.to);
    const providers = new Map<string, string>();
    const clients = new Map<string, string>();
    const contractStatuses = new Set<string>();
    const employeeStatuses = new Set<string>();
    const collaborators = new Map<string, TimelineCollaboratorAccumulator>();
    const events: TimelineEvent[] = [];
    const warnings: TimelineWarning[] = [];
    const currentContracts: Array<Record<string, unknown>> = [];
    const currentPositions: Array<Record<string, unknown>> = [];
    const currentCollaborators: Array<Record<string, unknown>> = [];

    const contractItems = contracts.map((contract) => {
      const providerName =
        contract.providerCompany.tradeName ?? contract.providerCompany.legalName;
      const clientName = contract.clientCompany.name;
      const contractStatus = this.contractGraphStatus(contract);

      providers.set(contract.providerCompany.publicId, providerName);
      clients.set(contract.clientCompany.publicId, clientName);
      contractStatuses.add(contractStatus);

      const positions = contract.positions.map((position) => {
        const allocations = position.links
          .filter((link) => this.shouldIncludeTimelineLink(link, query, period))
          .map((link) => {
            const status = this.timelineEmploymentStatus(link);
            const allocation: TimelineAllocation = {
              employmentLinkPublicId: link.publicId,
              personPublicId: link.person.publicId,
              personName: link.person.name,
              providerCompanyPublicId: contract.providerCompany.publicId,
              contractPublicId: contract.publicId,
              positionPublicId: position.publicId,
              startsAt: this.dateLabel(link.startsAt),
              endsAt: this.dateLabel(link.endsAt ?? link.dismissal?.dismissedAt),
              status,
              type: link.type
            };

            employeeStatuses.add(status);
            this.addTimelineCollaborator(
              collaborators,
              link,
              contract,
              position,
              status
            );
            this.addTimelineLinkEvents(
              events,
              warnings,
              collaborators,
              link,
              position,
              query,
              period
            );

            if (this.isTimelineLinkActiveAt(link, period.to)) {
              currentCollaborators.push({
                personPublicId: link.person.publicId,
                personName: link.person.name,
                employmentLinkPublicId: link.publicId,
                contractPublicId: contract.publicId,
                positionPublicId: position.publicId,
                status: 'active'
              });
            }

            return allocation;
          });

        const activeCollaborators = allocations.filter(
          (allocation) => allocation.status === 'active'
        ).length;
        const positionStatus = this.normalizedStatus(position.status);

        if (
          this.isTimelineContractActiveAt(contract, period.to) &&
          positionStatus === 'active'
        ) {
          currentPositions.push({
            publicId: position.publicId,
            contractPublicId: contract.publicId,
            displayName: position.name,
            status: positionStatus,
            activeCollaborators
          });
        }

        return {
          publicId: position.publicId,
          contractPublicId: contract.publicId,
          displayName: position.name,
          serviceName: position.service.name,
          location: position.location,
          shift: position.shift,
          schedule: position.schedule,
          status: positionStatus,
          startsAt: this.dateLabel(contract.startsAt),
          endsAt: this.dateLabel(contract.endsAt),
          dateSource: 'contract',
          allocations
        };
      });

      const activePositions = positions.filter(
        (position) => position.status === 'active'
      ).length;
      const activeCollaborators = positions.reduce(
        (total, position) =>
          total +
          position.allocations.filter(
            (allocation) => allocation.status === 'active'
          ).length,
        0
      );

      if (this.isTimelineContractActiveAt(contract, period.to)) {
        currentContracts.push({
          publicId: contract.publicId,
          displayName: `${providerName} -> ${clientName}`,
          status: contractStatus,
          activePositions,
          activeCollaborators
        });
      }

      return {
        publicId: contract.publicId,
        providerCompanyPublicId: contract.providerCompany.publicId,
        providerCompanyName: providerName,
        clientCompanyPublicId: contract.clientCompany.publicId,
        clientCompanyName: clientName,
        displayName: `${providerName} -> ${clientName}`,
        startsAt: this.dateLabel(contract.startsAt),
        endsAt: this.dateLabel(contract.endsAt),
        status: contractStatus,
        positions
      };
    });

    for (const record of timelineRecords) {
      events.push(this.mapTimelineRecordEvent(record));
    }

    for (const entry of calendarEntries) {
      events.push(this.mapTimelineCalendarEvent(entry));
    }

    const collaboratorItems = Array.from(collaborators.values())
      .map((item) => ({
        personPublicId: item.personPublicId,
        personName: item.personName,
        status: this.timelineCollaboratorStatus(item.statuses),
        segments: item.segments.sort((left, right) =>
          this.compareDateLabels(left.startsAt, right.startsAt)
        ),
        events: item.events.sort((left, right) =>
          this.compareDateLabels(left.occurredAt, right.occurredAt)
        )
      }))
      .sort((left, right) => left.personName.localeCompare(right.personName));
    const focus = this.timelineFocus(query, contracts);

    return {
      period: {
        preset: period.preset,
        from: periodFrom,
        to: periodTo
      },
      focus,
      layers: {
        contracts: contractItems,
        collaborators: collaboratorItems,
        events: events.sort((left, right) =>
          this.compareDateLabels(left.occurredAt, right.occurredAt)
        )
      },
      currentSnapshot: {
        contracts: currentContracts,
        positions: currentPositions,
        collaborators: currentCollaborators
      },
      filters: {
        search: query.search ?? '',
        applied: {
          periodPreset: period.preset,
          from: periodFrom,
          to: periodTo,
          focusCompanyPublicId: query.focusCompanyPublicId ?? null,
          focusCompanyType: query.focusCompanyType ?? null,
          rootCompanyPublicIds: query.rootCompanyPublicIds ?? [],
          clientCompanyPublicIds: query.clientCompanyPublicIds ?? [],
          contractStatuses: query.contractStatuses ?? [],
          employeeStatuses: query.employeeStatuses ?? [],
          includeHistorical: query.includeHistorical,
          includeMoves: query.includeMoves,
          includeOperationalEvents: query.includeOperationalEvents
        },
        available: {
          periodPresets: NETWORK_TIMELINE_PERIOD_PRESETS,
          rootCompanies: this.timelineOptions(providers),
          clientCompanies: this.timelineOptions(clients),
          contractStatuses: Array.from(contractStatuses).sort(),
          employeeStatuses: Array.from(employeeStatuses).sort()
        }
      },
      legend: {
        eventTypes: [
          { value: 'admission', label: 'Admissao' },
          { value: 'move', label: 'Movimentacao' },
          { value: 'dismissal', label: 'Desligamento' },
          { value: 'timeline_record', label: 'Registro manual' },
          { value: 'calendar_entry', label: 'Agenda' }
        ],
        relationshipStates: [
          { value: 'active', label: 'Ativo' },
          { value: 'historical', label: 'Historico' },
          { value: 'incomplete', label: 'Dado incompleto' }
        ]
      },
      warnings
    };
  }

  private buildTimelineContractWhere(
    query: NormalizedNetworkTimelineQuery,
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

    if (query.focusCompanyPublicId) {
      if (query.focusCompanyType === 'provider_company') {
        filters.push({
          providerCompany: { is: { publicId: query.focusCompanyPublicId } }
        });
      } else if (query.focusCompanyType === 'client_company') {
        filters.push({
          clientCompany: { is: { publicId: query.focusCompanyPublicId } }
        });
      } else {
        filters.push({
          OR: [
            { providerCompany: { is: { publicId: query.focusCompanyPublicId } } },
            { clientCompany: { is: { publicId: query.focusCompanyPublicId } } }
          ]
        });
      }
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

  private buildTimelineRecordWhere(
    query: NormalizedNetworkTimelineQuery,
    period: GraphPeriod,
    scope: TimelineEntityScope
  ): Prisma.TimelineRecordWhereInput {
    const referenceMonthFrom = this.startOfMonth(period.from);
    const referenceMonthTo = this.startOfMonth(period.to);
    const filters: Prisma.TimelineRecordWhereInput[] = [
      {
        OR: [
          { eventDate: { gte: period.from, lte: period.to } },
          {
            eventDate: null,
            referenceMonth: { gte: referenceMonthFrom, lte: referenceMonthTo }
          }
        ]
      },
      { status: { not: 'REMOVED' } }
    ];
    const search = query.search?.trim();
    const scopedPublicIds = Array.from(scope.allPublicIds);

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

    if (scopedPublicIds.length) {
      filters.push({
        links: {
          some: {
            entityPublicId: {
              in: scopedPublicIds
            }
          }
        }
      });
    }

    return { AND: filters };
  }

  private buildTimelineCalendarWhere(
    query: NormalizedNetworkTimelineQuery,
    period: GraphPeriod,
    scope: TimelineEntityScope
  ): Prisma.CalendarEntryWhereInput {
    const filters: Prisma.CalendarEntryWhereInput[] = [
      {
        startsAt: {
          gte: period.from,
          lte: period.to
        }
      }
    ];
    const search = query.search?.trim();
    const relationFilters = this.timelineCalendarScopeFilters(scope);

    if (search) {
      filters.push({
        OR: [
          { title: { contains: search } },
          { description: { contains: search } },
          { category: { contains: search } }
        ]
      });
    }

    if (relationFilters.length) {
      filters.push({ OR: relationFilters });
    }

    return { AND: filters };
  }

  private timelineCalendarScopeFilters(
    scope: TimelineEntityScope
  ): Prisma.CalendarEntryWhereInput[] {
    const filters: Prisma.CalendarEntryWhereInput[] = [];
    const providerCompanyPublicIds = Array.from(scope.providerCompanyPublicIds);
    const clientCompanyPublicIds = Array.from(scope.clientCompanyPublicIds);
    const contractPublicIds = Array.from(scope.contractPublicIds);
    const positionPublicIds = Array.from(scope.positionPublicIds);
    const employmentLinkPublicIds = Array.from(scope.employmentLinkPublicIds);
    const personPublicIds = Array.from(scope.personPublicIds);

    if (personPublicIds.length) {
      filters.push(
        { person: { publicId: { in: personPublicIds } } },
        { employmentLink: { person: { publicId: { in: personPublicIds } } } }
      );
    }

    if (providerCompanyPublicIds.length) {
      filters.push(
        { providerCompany: { publicId: { in: providerCompanyPublicIds } } },
        {
          contract: {
            providerCompany: { publicId: { in: providerCompanyPublicIds } }
          }
        },
        {
          employmentLink: {
            providerCompany: { publicId: { in: providerCompanyPublicIds } }
          }
        }
      );
    }

    if (clientCompanyPublicIds.length) {
      filters.push(
        { clientCompany: { publicId: { in: clientCompanyPublicIds } } },
        {
          contract: {
            clientCompany: { publicId: { in: clientCompanyPublicIds } }
          }
        },
        {
          employmentLink: {
            contract: {
              clientCompany: { publicId: { in: clientCompanyPublicIds } }
            }
          }
        }
      );
    }

    if (contractPublicIds.length) {
      filters.push(
        { contract: { publicId: { in: contractPublicIds } } },
        {
          employmentLink: {
            contract: { publicId: { in: contractPublicIds } }
          }
        }
      );
    }

    if (employmentLinkPublicIds.length) {
      filters.push({
        employmentLink: { publicId: { in: employmentLinkPublicIds } }
      });
    }

    if (positionPublicIds.length) {
      filters.push(
        { position: { publicId: { in: positionPublicIds } } },
        {
          employmentLink: {
            position: { publicId: { in: positionPublicIds } }
          }
        }
      );
    }

    return filters;
  }

  private buildTimelineEntityScope(
    contracts: TimelineContract[],
    query: NormalizedNetworkTimelineQuery,
    period: GraphPeriod
  ): TimelineEntityScope {
    const scope = this.emptyTimelineEntityScope();

    for (const publicId of query.rootCompanyPublicIds ?? []) {
      this.addTimelineScopeId(scope, 'providerCompanyPublicIds', publicId);
    }

    for (const publicId of query.clientCompanyPublicIds ?? []) {
      this.addTimelineScopeId(scope, 'clientCompanyPublicIds', publicId);
    }

    if (query.focusCompanyPublicId) {
      this.addTimelineScopeId(scope, 'allPublicIds', query.focusCompanyPublicId);

      if (query.focusCompanyType === 'provider_company') {
        this.addTimelineScopeId(
          scope,
          'providerCompanyPublicIds',
          query.focusCompanyPublicId
        );
      } else if (query.focusCompanyType === 'client_company') {
        this.addTimelineScopeId(
          scope,
          'clientCompanyPublicIds',
          query.focusCompanyPublicId
        );
      }
    }

    for (const contract of contracts) {
      this.addTimelineScopeId(
        scope,
        'providerCompanyPublicIds',
        contract.providerCompany.publicId
      );
      this.addTimelineScopeId(
        scope,
        'clientCompanyPublicIds',
        contract.clientCompany.publicId
      );
      this.addTimelineScopeId(scope, 'contractPublicIds', contract.publicId);

      for (const position of contract.positions) {
        this.addTimelineScopeId(scope, 'positionPublicIds', position.publicId);

        for (const link of position.links) {
          if (!this.shouldIncludeTimelineLink(link, query, period)) {
            continue;
          }

          this.addTimelineScopeId(
            scope,
            'employmentLinkPublicIds',
            link.publicId
          );
          this.addTimelineScopeId(scope, 'personPublicIds', link.person.publicId);
        }
      }
    }

    return scope;
  }

  private emptyTimelineEntityScope(): TimelineEntityScope {
    return {
      providerCompanyPublicIds: new Set<string>(),
      clientCompanyPublicIds: new Set<string>(),
      contractPublicIds: new Set<string>(),
      positionPublicIds: new Set<string>(),
      employmentLinkPublicIds: new Set<string>(),
      personPublicIds: new Set<string>(),
      allPublicIds: new Set<string>()
    };
  }

  private addTimelineScopeId(
    scope: TimelineEntityScope,
    key: keyof TimelineEntityScope,
    publicId: string
  ) {
    scope[key].add(publicId);
    scope.allPublicIds.add(publicId);
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
          activeClientCompanies: this.countActiveClientCompaniesForProvider(
            contracts,
            provider.id
          ),
          activeContracts: contracts.filter(
            (item) =>
              item.providerCompanyId === provider.id &&
              this.contractGraphStatus(item) === 'active'
          ).length,
          activeEmployees: this.countActiveEmployeesForProvider(
            contracts,
            provider.id
          ),
          historicalEmployees: this.countHistoricalEmployeesForProvider(
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
          activeEmployees: this.countActiveEmployeesForClient(
            contracts,
            client.id
          ),
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
            scale: position.schedule,
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
              position: position.name,
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

  private addTimelineCollaborator(
    collaborators: Map<string, TimelineCollaboratorAccumulator>,
    link: TimelineEmploymentLink,
    contract: TimelineContract,
    position: TimelineContract['positions'][number],
    status: string
  ) {
    let collaborator = collaborators.get(link.person.publicId);

    if (!collaborator) {
      collaborator = {
        personPublicId: link.person.publicId,
        personName: link.person.name,
        statuses: new Set<string>(),
        segments: [],
        events: []
      };
      collaborators.set(link.person.publicId, collaborator);
    }

    collaborator.statuses.add(status);
    collaborator.segments.push({
      kind: 'allocation',
      employmentLinkPublicId: link.publicId,
      contractPublicId: contract.publicId,
      positionPublicId: position.publicId,
      startsAt: this.dateLabel(link.startsAt),
      endsAt: this.dateLabel(link.endsAt ?? link.dismissal?.dismissedAt),
      status
    });
  }

  private addTimelineLinkEvents(
    events: TimelineEvent[],
    warnings: TimelineWarning[],
    collaborators: Map<string, TimelineCollaboratorAccumulator>,
    link: TimelineEmploymentLink,
    position: TimelineContract['positions'][number],
    query: NormalizedNetworkTimelineQuery,
    period: GraphPeriod
  ) {
    const collaborator = collaborators.get(link.person.publicId);

    if (!collaborator) {
      return;
    }

    const addEvent = (event: TimelineEvent) => {
      if (!event.occurredAt || !this.isDateLabelWithinPeriod(event.occurredAt, period)) {
        return;
      }

      events.push(event);
      collaborator.events.push(event);
    };

    addEvent(this.mapTimelineAdmissionEvent(link, position));

    if (query.includeMoves) {
      for (const move of link.moves) {
        if (this.normalizedStatus(move.moveType) === 'desligamento') {
          continue;
        }

        const event = this.mapTimelineMoveEvent(link, move);
        addEvent(event);

        if (event.occurredAt && this.isDateLabelWithinPeriod(event.occurredAt, period)) {
          warnings.push({
            code: 'employment_move_unstructured',
            severity: 'warning',
            entityPublicId: move.publicId,
            message:
              'Movimentacao possui origem/destino textual sem referencia estruturada para posto. O front pode listar o evento, mas nao deve desenhar conexao posicional.'
          });
        }
      }
    }

    if (link.dismissal) {
      addEvent(this.mapTimelineDismissalEvent(link, position));
    }
  }

  private mapTimelineAdmissionEvent(
    link: TimelineEmploymentLink,
    position: TimelineContract['positions'][number]
  ): TimelineEvent {
    return {
      publicId: `evt_adm_${link.publicId}`,
      eventType: 'admission',
      source: 'employment_link',
      occurredAt: this.dateLabel(link.startsAt),
      personPublicId: link.person.publicId,
      employmentLinkPublicId: link.publicId,
      positionPublicId: position.publicId,
      label: 'Admissao',
      notes: null
    };
  }

  private mapTimelineMoveEvent(
    link: TimelineEmploymentLink,
    move: TimelineEmploymentLink['moves'][number]
  ): TimelineEvent {
    return {
      publicId: move.publicId,
      eventType: 'move',
      source: 'employment_move',
      occurredAt: this.dateLabel(move.movedAt),
      personPublicId: link.person.publicId,
      employmentLinkPublicId: link.publicId,
      originPositionPublicId: null,
      destinationPositionPublicId: null,
      originLabel: move.origin,
      destinationLabel: move.destination,
      label: 'Movimentacao registrada sem referencia estruturada',
      notes: move.notes
    };
  }

  private mapTimelineDismissalEvent(
    link: TimelineEmploymentLink,
    position: TimelineContract['positions'][number]
  ): TimelineEvent {
    return {
      publicId: link.dismissal!.publicId,
      eventType: 'dismissal',
      source: 'dismissal',
      occurredAt: this.dateLabel(link.dismissal!.dismissedAt),
      personPublicId: link.person.publicId,
      employmentLinkPublicId: link.publicId,
      positionPublicId: position.publicId,
      label: 'Desligamento',
      notes: link.dismissal!.reason
    };
  }

  private mapTimelineRecordEvent(record: TimelineRecord): TimelineEvent {
    return {
      publicId: record.publicId,
      eventType: 'timeline_record',
      source: 'timeline_record',
      occurredAt: this.dateLabel(record.eventDate ?? record.referenceMonth),
      label: record.title,
      notes: record.description,
      linkedEntities: record.links.map((link) => ({
        entityType: this.timelineEntityType(link.entityType),
        entityPublicId: link.entityPublicId,
        labelSnapshot: link.labelSnapshot
      }))
    };
  }

  private mapTimelineCalendarEvent(
    entry: TimelineCalendarEntry
  ): TimelineEvent {
    return {
      publicId: entry.publicId,
      eventType: 'calendar_entry',
      source: 'calendar_entry',
      occurredAt: this.dateLabel(entry.startsAt),
      label: entry.title,
      notes: entry.description,
      linkedEntities: this.timelineCalendarLinkedEntities(entry)
    };
  }

  private timelineCalendarLinkedEntities(entry: TimelineCalendarEntry) {
    const entities = new Map<
      string,
      { entityType: string; entityPublicId: string | null; labelSnapshot: string }
    >();
    const person = entry.person ?? entry.employmentLink?.person ?? null;
    const providerCompany =
      entry.providerCompany ??
      entry.contract?.providerCompany ??
      entry.employmentLink?.providerCompany ??
      null;
    const clientCompany =
      entry.clientCompany ??
      entry.contract?.clientCompany ??
      entry.employmentLink?.contract.clientCompany ??
      null;
    const contract = entry.contract ?? entry.employmentLink?.contract ?? null;
    const position = entry.position ?? entry.employmentLink?.position ?? null;

    const addEntity = (
      entityType: string,
      entityPublicId: string | null | undefined,
      labelSnapshot: string | null | undefined
    ) => {
      if (!entityPublicId || !labelSnapshot) {
        return;
      }

      entities.set(`${entityType}:${entityPublicId}`, {
        entityType,
        entityPublicId,
        labelSnapshot
      });
    };

    addEntity('person', person?.publicId, person?.name);
    addEntity(
      'provider_company',
      providerCompany?.publicId,
      providerCompany
        ? providerCompany.tradeName ?? providerCompany.legalName
        : null
    );
    addEntity('client_company', clientCompany?.publicId, clientCompany?.name);
    addEntity('contract', contract?.publicId, contract?.publicId);
    addEntity(
      'employment_link',
      entry.employmentLink?.publicId,
      entry.employmentLink?.person.name
    );
    addEntity('position', position?.publicId, position?.name);

    return Array.from(entities.values());
  }

  private timelineFocus(
    query: NormalizedNetworkTimelineQuery,
    contracts: TimelineContract[]
  ) {
    let companyType = query.focusCompanyType ?? null;
    let displayName: string | null = null;

    if (query.focusCompanyPublicId) {
      for (const contract of contracts) {
        if (contract.providerCompany.publicId === query.focusCompanyPublicId) {
          companyType = companyType ?? 'provider_company';
          displayName =
            contract.providerCompany.tradeName ??
            contract.providerCompany.legalName;
          break;
        }

        if (contract.clientCompany.publicId === query.focusCompanyPublicId) {
          companyType = companyType ?? 'client_company';
          displayName = contract.clientCompany.name;
          break;
        }
      }
    }

    return {
      companyPublicId: query.focusCompanyPublicId ?? null,
      companyType,
      displayName
    };
  }

  private timelineOptions(items: Map<string, string>) {
    return Array.from(items.entries())
      .map(([publicId, label]) => ({ publicId, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
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

  private normalizeTimelineQuery(
    query: NetworkTimelineQueryDto
  ): NormalizedNetworkTimelineQuery {
    return {
      ...query,
      search: query.search?.trim(),
      contractStatuses: query.contractStatuses?.map((item) =>
        this.normalizedStatus(item)
      ),
      employeeStatuses: query.employeeStatuses?.map((item) =>
        this.normalizedStatus(item)
      ),
      includeHistorical: query.includeHistorical ?? true,
      includeMoves: query.includeMoves ?? true,
      includeOperationalEvents: query.includeOperationalEvents ?? true
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

  private resolveTimelinePeriod(query: NetworkTimelineQueryDto): GraphPeriod {
    const preset = query.periodPreset ?? '1y';
    let period: GraphPeriod;

    if (preset === '5y') {
      const to = new Date();
      const from = new Date(to);
      from.setFullYear(from.getFullYear() - 5);
      period = { preset, from, to };
    } else {
      period = this.resolvePeriod(preset);
    }

    const from = query.from ? this.startOfDateOnly(query.from) : period.from;
    const to = query.to ? this.endOfDateOnly(query.to) : period.to;

    if (from > to) {
      throw new BadRequestException(
        'O periodo inicial da timeline nao pode ser maior que o periodo final.'
      );
    }

    return {
      preset: period.preset,
      from,
      to
    };
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
    link: GraphEmploymentLink,
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

  private shouldIncludeTimelineLink(
    link: TimelineEmploymentLink,
    query: NormalizedNetworkTimelineQuery,
    period: GraphPeriod
  ): boolean {
    const status = this.timelineEmploymentStatus(link);

    if (query.employeeStatuses?.length && !query.employeeStatuses.includes(status)) {
      return false;
    }

    if (!query.includeHistorical && status !== 'active') {
      return false;
    }

    if (period.preset === 'all') {
      return true;
    }

    const end = link.endsAt ?? link.dismissal?.dismissedAt;
    return link.startsAt <= period.to && (!end || end >= period.from);
  }

  private contractGraphStatus(
    contract: Pick<GraphContract, 'status' | 'endsAt'>
  ): string {
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
    link: NetworkEmploymentLink
  ): string {
    if (link.status === EmploymentLinkStatus.ACTIVE && !link.endsAt) {
      return 'active';
    }

    if (link.status === EmploymentLinkStatus.DISMISSED || link.dismissal) {
      return 'dismissed';
    }

    return this.normalizedStatus(link.status);
  }

  private timelineEmploymentStatus(link: TimelineEmploymentLink): string {
    if (link.status === EmploymentLinkStatus.DISMISSED || link.dismissal) {
      return 'dismissed';
    }

    if (link.status === EmploymentLinkStatus.ACTIVE && !link.endsAt) {
      return 'active';
    }

    if (link.endsAt) {
      return 'historical';
    }

    return this.normalizedStatus(link.status);
  }

  private isActiveLink(
    link: NetworkEmploymentLink
  ): boolean {
    return link.status === EmploymentLinkStatus.ACTIVE && !link.endsAt && !link.dismissal;
  }

  private isTimelineContractActiveAt(
    contract: Pick<TimelineContract, 'startsAt' | 'endsAt' | 'status'>,
    at: Date
  ): boolean {
    return (
      this.normalizedStatus(contract.status) === 'active' &&
      contract.startsAt <= at &&
      (!contract.endsAt || contract.endsAt >= at)
    );
  }

  private isTimelineLinkActiveAt(link: TimelineEmploymentLink, at: Date): boolean {
    return (
      this.timelineEmploymentStatus(link) === 'active' &&
      link.startsAt <= at &&
      (!link.endsAt || link.endsAt >= at)
    );
  }

  private countActiveClientCompaniesForProvider(
    contracts: GraphContract[],
    providerCompanyId: bigint
  ): number {
    const clients = new Set<string>();

    for (const contract of contracts) {
      if (
        contract.providerCompanyId === providerCompanyId &&
        this.contractGraphStatus(contract) === 'active'
      ) {
        clients.add(contract.clientCompany.publicId);
      }
    }

    return clients.size;
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

  private countHistoricalEmployeesForProvider(
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
          if (!this.isActiveLink(link)) {
            people.add(link.person.publicId);
          }
        }
      }
    }

    return people.size;
  }

  private countActiveEmployeesForClient(
    contracts: GraphContract[],
    clientCompanyId: bigint
  ): number {
    const people = new Set<string>();

    for (const contract of contracts) {
      if (contract.clientCompanyId !== clientCompanyId) {
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

  private timelineEntityType(value: string): string {
    return value.trim().toLowerCase();
  }

  private timelineCollaboratorStatus(statuses: Set<string>): string {
    if (statuses.has('active')) {
      return 'active';
    }

    if (statuses.has('dismissed')) {
      return 'dismissed';
    }

    if (statuses.has('historical')) {
      return 'historical';
    }

    return Array.from(statuses)[0] ?? 'historical';
  }

  private dateLabel(value?: Date | null): string | null {
    return value ? value.toISOString().slice(0, 10) : null;
  }

  private isDateLabelWithinPeriod(value: string, period: GraphPeriod): boolean {
    const date = this.startOfDateOnly(value);

    return date >= this.startOfDateOnly(this.dateLabel(period.from)!) &&
      date <= this.endOfDateOnly(this.dateLabel(period.to)!);
  }

  private compareDateLabels(left: string | null, right: string | null): number {
    if (left === right) {
      return 0;
    }

    if (!left) {
      return 1;
    }

    if (!right) {
      return -1;
    }

    return left.localeCompare(right);
  }

  private startOfDateOnly(value: string): Date {
    const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Data inicial da timeline invalida.');
    }

    return date;
  }

  private endOfDateOnly(value: string): Date {
    const date = new Date(`${value.slice(0, 10)}T23:59:59.999Z`);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Data final da timeline invalida.');
    }

    return date;
  }

  private startOfMonth(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
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
