import { Inject, Injectable } from '@nestjs/common';
import { EmploymentLinkStatus, Prisma } from '@prisma/client';
import { tenantWhere } from '../../common/tenant/tenant-scope';
import { PrismaService } from '../../infra/database/prisma.service';
import { AuthTokenPayload } from '../auth/interfaces/auth-token-payload.interface';
import { GlobalSearchQueryDto } from './dto/global-search-query.dto';
import {
  GLOBAL_SEARCH_LABELS,
  GLOBAL_SEARCH_TYPES,
  GlobalSearchType
} from './global-search.constants';

const personSearchInclude = {
  links: {
    where: {
      status: EmploymentLinkStatus.ACTIVE
    },
    orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
    take: 1,
    include: {
      providerCompany: true,
      contract: {
        include: {
          clientCompany: true
        }
      },
      position: true
    }
  }
} satisfies Prisma.PersonInclude;

const contractSearchInclude = {
  providerCompany: true,
  clientCompany: true,
  contractType: true,
  contractModel: true
} satisfies Prisma.ContractInclude;

const positionSearchInclude = {
  service: true,
  contract: {
    include: {
      providerCompany: true,
      clientCompany: true
    }
  }
} satisfies Prisma.PositionInclude;

type PersonSearchRow = Prisma.PersonGetPayload<{
  include: typeof personSearchInclude;
}>;
type ContractSearchRow = Prisma.ContractGetPayload<{
  include: typeof contractSearchInclude;
}>;
type PositionSearchRow = Prisma.PositionGetPayload<{
  include: typeof positionSearchInclude;
}>;
type ProviderCompanySearchRow = Prisma.ProviderCompanyGetPayload<Record<string, never>>;
type ClientCompanySearchRow = Prisma.ClientCompanyGetPayload<Record<string, never>>;

type SearchRouteTarget = {
  workspace: string;
  publicId: string;
};

type SearchItem = {
  publicId: string;
  title: string;
  subtitle?: string | null;
  context?: string | null;
  routeTarget: SearchRouteTarget;
  badges: string[];
};

type InternalSearchGroup = {
  type: GlobalSearchType;
  label: string;
  items: SearchItem[];
  authorizedTotal: number;
};

@Injectable()
export class SearchService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async search(query: GlobalSearchQueryDto, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    const searchTerm = query.q.trim();
    const limit = Math.min(Math.max(Number(query.limit ?? 5), 1), 10);
    const selectedTypes = query.types?.length
      ? query.types
      : [...GLOBAL_SEARCH_TYPES];

    const groups = await Promise.all(
      selectedTypes.map((type) =>
        this.searchGroup(type, searchTerm, {
          actor,
          includeInactive: query.includeInactive,
          includeSensitive: actor.capabilities.canViewSensitive,
          limit
        })
      )
    );

    return {
      groups: groups
        .filter((group) => group.items.length > 0)
        .map(({ authorizedTotal: _authorizedTotal, ...group }) => group),
      meta: {
        query: searchTerm,
        authorizedTotal: groups.reduce(
          (total, group) => total + group.authorizedTotal,
          0
        )
      }
    };
  }

  private searchGroup(
    type: GlobalSearchType,
    searchTerm: string,
    options: {
      actor: AuthTokenPayload;
      includeInactive: boolean;
      includeSensitive: boolean;
      limit: number;
    }
  ): Promise<InternalSearchGroup> {
    switch (type) {
      case 'people':
        return this.searchPeople(searchTerm, options);
      case 'provider_companies':
        return this.searchProviderCompanies(searchTerm, options);
      case 'client_companies':
        return this.searchClientCompanies(searchTerm, options);
      case 'contracts':
        return this.searchContracts(searchTerm, options);
      case 'positions':
        return this.searchPositions(searchTerm, options);
    }
  }

  private async searchPeople(
    searchTerm: string,
    options: {
      actor: AuthTokenPayload;
      includeSensitive: boolean;
      limit: number;
    }
  ): Promise<InternalSearchGroup> {
    const or: Prisma.PersonWhereInput[] = [
      { publicId: searchTerm },
      { name: { startsWith: searchTerm } },
      { name: { contains: searchTerm } }
    ];

    if (options.includeSensitive) {
      or.push(
        { cpf: { contains: searchTerm } },
        { email: { contains: searchTerm } },
        { phone: { contains: searchTerm } }
      );
    }

    const where = tenantWhere(options.actor, { OR: or });
    const [authorizedTotal, rows] = await Promise.all([
      this.prisma.person.count({ where }),
      this.prisma.person.findMany({
        where,
        take: this.fetchLimit(options.limit),
        orderBy: { name: 'asc' },
        include: personSearchInclude
      })
    ]);

    const items = this.sortRows(rows, searchTerm, (row) => ({
      publicId: row.publicId,
      title: row.name,
      names: [row.name],
      sensitive: [row.cpf, row.email, row.phone]
    }))
      .slice(0, options.limit)
      .map((row) => this.mapPerson(row, options.includeSensitive));

    return this.group('people', items, authorizedTotal);
  }

  private async searchProviderCompanies(
    searchTerm: string,
    options: {
      actor: AuthTokenPayload;
      includeInactive: boolean;
      includeSensitive: boolean;
      limit: number;
    }
  ): Promise<InternalSearchGroup> {
    const or: Prisma.ProviderCompanyWhereInput[] = [
      { publicId: searchTerm },
      { legalName: { startsWith: searchTerm } },
      { tradeName: { startsWith: searchTerm } },
      { legalName: { contains: searchTerm } },
      { tradeName: { contains: searchTerm } }
    ];

    if (options.includeSensitive) {
      or.push({ document: { contains: searchTerm } });
    }

    const where = tenantWhere(options.actor, {
      AND: [
        { OR: or },
        ...(options.includeInactive ? [] : [{ status: 'ACTIVE' }])
      ]
    });
    const [authorizedTotal, rows] = await Promise.all([
      this.prisma.providerCompany.count({ where }),
      this.prisma.providerCompany.findMany({
        where,
        take: this.fetchLimit(options.limit),
        orderBy: [{ updatedAt: 'desc' }, { legalName: 'asc' }]
      })
    ]);

    const items = this.sortRows(rows, searchTerm, (row) => ({
      publicId: row.publicId,
      title: row.tradeName ?? row.legalName,
      names: [row.tradeName, row.legalName],
      sensitive: [row.document],
      status: row.status
    }))
      .slice(0, options.limit)
      .map((row) => this.mapProviderCompany(row, options.includeSensitive));

    return this.group('provider_companies', items, authorizedTotal);
  }

  private async searchClientCompanies(
    searchTerm: string,
    options: {
      actor: AuthTokenPayload;
      includeInactive: boolean;
      includeSensitive: boolean;
      limit: number;
    }
  ): Promise<InternalSearchGroup> {
    const or: Prisma.ClientCompanyWhereInput[] = [
      { publicId: searchTerm },
      { name: { startsWith: searchTerm } },
      { name: { contains: searchTerm } },
      { clientType: { contains: searchTerm } },
      { contactName: { contains: searchTerm } }
    ];

    if (options.includeSensitive) {
      or.push({ document: { contains: searchTerm } });
    }

    const where = tenantWhere(options.actor, {
      AND: [
        { OR: or },
        ...(options.includeInactive ? [] : [{ status: 'ACTIVE' }])
      ]
    });
    const [authorizedTotal, rows] = await Promise.all([
      this.prisma.clientCompany.count({ where }),
      this.prisma.clientCompany.findMany({
        where,
        take: this.fetchLimit(options.limit),
        orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }]
      })
    ]);

    const items = this.sortRows(rows, searchTerm, (row) => ({
      publicId: row.publicId,
      title: row.name,
      names: [row.name, row.clientType, row.contactName],
      sensitive: [row.document],
      status: row.status
    }))
      .slice(0, options.limit)
      .map((row) => this.mapClientCompany(row, options.includeSensitive));

    return this.group('client_companies', items, authorizedTotal);
  }

  private async searchContracts(
    searchTerm: string,
    options: {
      actor: AuthTokenPayload;
      includeInactive: boolean;
      includeSensitive: boolean;
      limit: number;
    }
  ): Promise<InternalSearchGroup> {
    const or: Prisma.ContractWhereInput[] = [
      { publicId: searchTerm },
      { status: { contains: searchTerm } },
      { providerCompany: { is: { legalName: { contains: searchTerm } } } },
      { providerCompany: { is: { tradeName: { contains: searchTerm } } } },
      { clientCompany: { is: { name: { contains: searchTerm } } } },
      { contractType: { is: { name: { contains: searchTerm } } } },
      { contractModel: { is: { name: { contains: searchTerm } } } }
    ];

    if (options.includeSensitive) {
      or.push(
        {
          providerCompany: {
            is: { document: { contains: searchTerm } }
          }
        },
        {
          clientCompany: {
            is: { document: { contains: searchTerm } }
          }
        }
      );
    }

    const where = tenantWhere(options.actor, {
      AND: [
        { OR: or },
        ...(options.includeInactive ? [] : [{ status: 'ACTIVE' }])
      ]
    });
    const [authorizedTotal, rows] = await Promise.all([
      this.prisma.contract.count({ where }),
      this.prisma.contract.findMany({
        where,
        take: this.fetchLimit(options.limit),
        orderBy: [{ updatedAt: 'desc' }, { publicId: 'asc' }],
        include: contractSearchInclude
      })
    ]);

    const items = this.sortRows(rows, searchTerm, (row) => ({
      publicId: row.publicId,
      title: this.contractTitle(row),
      names: [
        row.publicId,
        row.clientCompany.name,
        row.providerCompany.tradeName,
        row.providerCompany.legalName,
        row.contractType?.name,
        row.contractModel?.name
      ],
      sensitive: [row.providerCompany.document, row.clientCompany.document],
      status: row.status
    }))
      .slice(0, options.limit)
      .map((row) => this.mapContract(row));

    return this.group('contracts', items, authorizedTotal);
  }

  private async searchPositions(
    searchTerm: string,
    options: {
      actor: AuthTokenPayload;
      includeInactive: boolean;
      includeSensitive: boolean;
      limit: number;
    }
  ): Promise<InternalSearchGroup> {
    const or: Prisma.PositionWhereInput[] = [
      { publicId: searchTerm },
      { name: { startsWith: searchTerm } },
      { name: { contains: searchTerm } },
      { location: { contains: searchTerm } },
      { shift: { contains: searchTerm } },
      { schedule: { contains: searchTerm } },
      { service: { is: { name: { contains: searchTerm } } } },
      { contract: { is: { clientCompany: { is: { name: { contains: searchTerm } } } } } },
      {
        contract: {
          is: { providerCompany: { is: { legalName: { contains: searchTerm } } } }
        }
      },
      {
        contract: {
          is: { providerCompany: { is: { tradeName: { contains: searchTerm } } } }
        }
      }
    ];

    if (options.includeSensitive) {
      or.push(
        {
          contract: {
            is: {
              providerCompany: {
                is: { document: { contains: searchTerm } }
              }
            }
          }
        },
        {
          contract: {
            is: {
              clientCompany: {
                is: { document: { contains: searchTerm } }
              }
            }
          }
        }
      );
    }

    const where = tenantWhere(options.actor, {
      AND: [
        { OR: or },
        ...(options.includeInactive ? [] : [{ status: 'ACTIVE' }])
      ]
    });
    const [authorizedTotal, rows] = await Promise.all([
      this.prisma.position.count({ where }),
      this.prisma.position.findMany({
        where,
        take: this.fetchLimit(options.limit),
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        include: positionSearchInclude
      })
    ]);

    const items = this.sortRows(rows, searchTerm, (row) => ({
      publicId: row.publicId,
      title: row.name,
      names: [
        row.name,
        row.location,
        row.shift,
        row.schedule,
        row.service.name,
        row.contract.clientCompany.name,
        row.contract.providerCompany.tradeName,
        row.contract.providerCompany.legalName
      ],
      sensitive: [
        row.contract.providerCompany.document,
        row.contract.clientCompany.document
      ],
      status: row.status
    }))
      .slice(0, options.limit)
      .map((row) => this.mapPosition(row));

    return this.group('positions', items, authorizedTotal);
  }

  private group(
    type: GlobalSearchType,
    items: SearchItem[],
    authorizedTotal: number
  ): InternalSearchGroup {
    return {
      type,
      label: GLOBAL_SEARCH_LABELS[type],
      items,
      authorizedTotal
    };
  }

  private mapPerson(
    row: PersonSearchRow,
    includeSensitive: boolean
  ): SearchItem {
    const link = row.links[0];
    const maskedCpf = this.maskedDocument('CPF', row.cpf, includeSensitive);
    return {
      publicId: row.publicId,
      title: row.name,
      subtitle: link?.position.name ?? 'Pessoa',
      context: link
        ? this.joinText([
            link.contract.clientCompany.name,
            link.providerCompany.tradeName ?? link.providerCompany.legalName
          ])
        : null,
      routeTarget: {
        workspace: 'people',
        publicId: row.publicId
      },
      badges: this.badges(['Ativo', maskedCpf])
    };
  }

  private mapProviderCompany(
    row: ProviderCompanySearchRow,
    includeSensitive: boolean
  ): SearchItem {
    return {
      publicId: row.publicId,
      title: row.tradeName ?? row.legalName,
      subtitle: row.tradeName ? row.legalName : 'Empresa prestadora',
      context: this.maskedDocument('CNPJ', row.document, includeSensitive),
      routeTarget: {
        workspace: 'provider_companies',
        publicId: row.publicId
      },
      badges: this.badges([this.statusLabel(row.status)])
    };
  }

  private mapClientCompany(
    row: ClientCompanySearchRow,
    includeSensitive: boolean
  ): SearchItem {
    return {
      publicId: row.publicId,
      title: row.name,
      subtitle: row.clientType,
      context: this.maskedDocument('Documento', row.document, includeSensitive),
      routeTarget: {
        workspace: 'client_companies',
        publicId: row.publicId
      },
      badges: this.badges([this.statusLabel(row.status)])
    };
  }

  private mapContract(row: ContractSearchRow): SearchItem {
    return {
      publicId: row.publicId,
      title: this.contractTitle(row),
      subtitle: row.providerCompany.tradeName ?? row.providerCompany.legalName,
      context: this.joinText([
        row.contractType?.name,
        row.contractModel?.name,
        row.clientCompany.name
      ]),
      routeTarget: {
        workspace: 'contracts',
        publicId: row.publicId
      },
      badges: this.badges([this.statusLabel(row.status)])
    };
  }

  private mapPosition(row: PositionSearchRow): SearchItem {
    return {
      publicId: row.publicId,
      title: row.name,
      subtitle: row.service.name,
      context: this.joinText([
        row.contract.clientCompany.name,
        row.contract.providerCompany.tradeName ??
          row.contract.providerCompany.legalName
      ]),
      routeTarget: {
        workspace: 'contracts',
        publicId: row.contract.publicId
      },
      badges: this.badges([this.statusLabel(row.status)])
    };
  }

  private contractTitle(row: ContractSearchRow): string {
    return `Contrato ${row.clientCompany.name}`;
  }

  private sortRows<T>(
    rows: T[],
    searchTerm: string,
    picker: (row: T) => {
      publicId: string;
      title: string;
      names: Array<string | null | undefined>;
      sensitive: Array<string | null | undefined>;
      status?: string | null;
    }
  ): T[] {
    return [...rows].sort((left, right) => {
      const leftData = picker(left);
      const rightData = picker(right);
      const score =
        this.score(leftData, searchTerm) - this.score(rightData, searchTerm);
      if (score !== 0) {
        return score;
      }

      const active =
        this.activeRank(leftData.status) - this.activeRank(rightData.status);
      if (active !== 0) {
        return active;
      }

      return leftData.title.localeCompare(rightData.title, 'pt-BR');
    });
  }

  private score(
    data: {
      publicId: string;
      names: Array<string | null | undefined>;
      sensitive: Array<string | null | undefined>;
    },
    searchTerm: string
  ): number {
    const query = this.normalize(searchTerm);
    if (this.normalize(data.publicId) === query) {
      return 0;
    }
    if (data.names.some((value) => this.normalize(value).startsWith(query))) {
      return 10;
    }
    if (data.sensitive.some((value) => this.normalize(value).includes(query))) {
      return 20;
    }
    if (data.names.some((value) => this.normalize(value).includes(query))) {
      return 30;
    }
    return 40;
  }

  private activeRank(status?: string | null): number {
    return !status || status === 'ACTIVE' ? 0 : 1;
  }

  private fetchLimit(limit: number): number {
    return Math.min(Math.max(limit * 10, 50), 100);
  }

  private statusLabel(status?: string | null): string | null {
    if (!status) {
      return null;
    }

    const labels: Record<string, string> = {
      ACTIVE: 'Ativo',
      INACTIVE: 'Inativo',
      PENDING: 'Pendente',
      SUSPENDED: 'Suspenso',
      DISMISSED: 'Desligado',
      BLOCKED: 'Bloqueado'
    };
    return labels[status] ?? status;
  }

  private maskedDocument(
    label: string,
    value: string | null | undefined,
    includeSensitive: boolean
  ): string | null {
    if (!includeSensitive || !value) {
      return null;
    }

    const digits = value.replace(/\D/g, '');
    if (!digits) {
      return null;
    }

    return `${label} final ${digits.slice(-4)}`;
  }

  private badges(values: Array<string | null | undefined>): string[] {
    return values.filter((value): value is string => Boolean(value));
  }

  private joinText(values: Array<string | null | undefined>): string | null {
    const parts = values.filter((value): value is string => Boolean(value));
    return parts.length > 0 ? parts.join(' / ') : null;
  }

  private normalize(value: string | null | undefined): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
}
