import { Inject, Injectable } from "@nestjs/common";
import { EmploymentLinkStatus, OccurrenceNature, Prisma } from "@prisma/client";
import { tenantWhere } from "../../common/tenant/tenant-scope";
import { PrismaService } from "../../infra/database/prisma.service";
import { AuthTokenPayload } from "../auth/interfaces/auth-token-payload.interface";

type DashboardHomeQuery = Record<string, string | string[] | undefined>;

type DashboardEmploymentLink = Prisma.EmploymentLinkGetPayload<{
  include: {
    person: true;
    providerCompany: true;
    contract: {
      include: {
        clientCompany: true;
        providerCompany: true;
        contractType: true;
        contractModel: true;
      };
    };
    position: {
      include: {
        service: true;
      };
    };
  };
}>;

type DashboardContractOption = Prisma.ContractGetPayload<{
  include: {
    clientCompany: true;
    providerCompany: true;
    contractType: true;
    contractModel: true;
  };
}>;

type DashboardPeriod = {
  key: string;
  label: string;
  shortLabel: string;
  start?: Date;
  end?: Date;
  metricStart: Date;
  metricEnd: Date;
};

type DashboardFilterInput = {
  contractIds: string[];
  units: string[];
  departments: string[];
  positions: string[];
  regimes: string[];
};

@Injectable()
export class DashboardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async home(query: DashboardHomeQuery = {}, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    const now = new Date();
    const filters = this.parseFilters(query);
    const period = this.resolvePeriod(query, now);
    const linkWhere = tenantWhere(actor, this.buildLinkWhere(filters, period));

    const [contracts, activeLinks, pendingLinks, periodLinks, riskItems] =
      await Promise.all([
        this.prisma.contract.findMany({
          where: tenantWhere(actor, {
            status: "ACTIVE",
          }),
          orderBy: [{ startsAt: "desc" }, { id: "desc" }],
          include: {
            clientCompany: true,
            providerCompany: true,
            contractType: true,
            contractModel: true,
          },
        }),
        this.prisma.employmentLink.findMany({
          where: {
            ...linkWhere,
            status: EmploymentLinkStatus.ACTIVE,
          },
          take: 500,
          orderBy: [{ startsAt: "desc" }, { id: "desc" }],
          include: dashboardLinkInclude,
        }),
        this.prisma.employmentLink.findMany({
          where: {
            ...linkWhere,
            status: EmploymentLinkStatus.PENDING,
          },
          take: 500,
          orderBy: [{ startsAt: "desc" }, { id: "desc" }],
          include: dashboardLinkInclude,
        }),
        this.prisma.employmentLink.findMany({
          where: tenantWhere(actor, {
            ...this.buildLinkWhere(filters, {
              ...period,
              start: period.metricStart,
              end: period.metricEnd,
            }),
            status: {
              in: [EmploymentLinkStatus.ACTIVE, EmploymentLinkStatus.PENDING],
            },
          }),
          take: 500,
          orderBy: [{ startsAt: "desc" }, { id: "desc" }],
          include: dashboardLinkInclude,
        }),
        this.prisma.occurrence.count({
          where: tenantWhere(actor, {
            nature: OccurrenceNature.NEGATIVE,
            occurredAt: this.dateRangeWhere(period.start, period.end),
          }),
        }),
      ]);

    const filteredActiveLinks = activeLinks.filter((link) =>
      this.matchesComputedFilters(link, filters),
    );
    const filteredPendingLinks = pendingLinks.filter((link) =>
      this.matchesComputedFilters(link, filters),
    );
    const filteredPeriodLinks = periodLinks.filter((link) =>
      this.matchesComputedFilters(link, filters),
    );

    return {
      generatedAt: now,
      baseDate: now,
      period: this.serializePeriod(period),
      metrics: {
        providerCompanies: this.uniqueCount(
          filteredActiveLinks.map((link) => link.providerCompany.publicId),
        ),
        clientCompanies: this.uniqueCount(
          filteredActiveLinks.map(
            (link) => link.contract.clientCompany.publicId,
          ),
        ),
        activeContracts: this.uniqueCount(
          filteredActiveLinks.map((link) => link.contract.publicId),
        ),
        activeEmployees: filteredActiveLinks.length,
        newEmployees30Days: filteredPeriodLinks.length,
        pendingLinks: filteredPendingLinks.length,
        riskItems,
      },
      filters: this.buildFilters(contracts, activeLinks),
      rows: filteredActiveLinks.slice(0, 10).map((link) => this.mapLinkRow(link)),
    };
  }

  private parseFilters(query: DashboardHomeQuery): DashboardFilterInput {
    return {
      contractIds: parseCsvQuery(query.contractIds),
      units: parseCsvQuery(query.units),
      departments: parseCsvQuery(query.departments),
      positions: parseCsvQuery(query.positions),
      regimes: parseCsvQuery(query.regimes),
    };
  }

  private resolvePeriod(query: DashboardHomeQuery, now: Date): DashboardPeriod {
    const today = startOfDay(now);
    const preset = firstQueryValue(query.datePreset) ?? "current";
    const customStart = parseDateOnly(firstQueryValue(query.dateFrom));
    const customEnd = parseDateOnly(firstQueryValue(query.dateTo));

    if (preset === "custom" && customStart && customEnd) {
      return {
        key: "custom",
        label: `${formatShortDate(customStart)} a ${formatShortDate(customEnd)}`,
        shortLabel: "recorte",
        start: customStart,
        end: customEnd,
        metricStart: customStart,
        metricEnd: customEnd,
      };
    }

    const presets: Record<string, DashboardPeriod> = {
      current: {
        key: "current",
        label: "Estatisticas atuais",
        shortLabel: "30 dias",
        metricStart: addDays(today, -30),
        metricEnd: today,
      },
      last30: {
        key: "last30",
        label: "Ultimos 30 dias",
        shortLabel: "30 dias",
        start: addDays(today, -30),
        end: today,
        metricStart: addDays(today, -30),
        metricEnd: today,
      },
      last45: {
        key: "last45",
        label: "Ultimos 45 dias",
        shortLabel: "45 dias",
        start: addDays(today, -45),
        end: today,
        metricStart: addDays(today, -45),
        metricEnd: today,
      },
      last90: {
        key: "last90",
        label: "Ultimos 90 dias",
        shortLabel: "90 dias",
        start: addDays(today, -90),
        end: today,
        metricStart: addDays(today, -90),
        metricEnd: today,
      },
      last6m: {
        key: "last6m",
        label: "Ultimos 6 meses",
        shortLabel: "6 meses",
        start: addMonths(today, -6),
        end: today,
        metricStart: addMonths(today, -6),
        metricEnd: today,
      },
      last1y: {
        key: "last1y",
        label: "Ultimo ano",
        shortLabel: "1 ano",
        start: addMonths(today, -12),
        end: today,
        metricStart: addMonths(today, -12),
        metricEnd: today,
      },
    };

    return presets[preset] ?? presets.current;
  }

  private buildLinkWhere(
    filters: DashboardFilterInput,
    period: Pick<DashboardPeriod, "start" | "end">,
  ): Prisma.EmploymentLinkWhereInput {
    const contractFilter: Prisma.ContractWhereInput = {};
    const positionFilter: Prisma.PositionWhereInput = {};

    if (filters.contractIds.length > 0) {
      contractFilter.publicId = { in: filters.contractIds };
    }

    if (filters.positions.length > 0) {
      positionFilter.name = { in: filters.positions };
    }

    const where: Prisma.EmploymentLinkWhereInput = {
      startsAt: this.dateRangeWhere(period.start, period.end),
    };

    if (Object.keys(contractFilter).length > 0) {
      where.contract = contractFilter;
    }

    if (Object.keys(positionFilter).length > 0) {
      where.position = positionFilter;
    }

    if (filters.regimes.length > 0) {
      where.type = { in: filters.regimes };
    }

    return where;
  }

  private dateRangeWhere(start?: Date, end?: Date) {
    if (!start && !end) {
      return undefined;
    }

    return {
      ...(start ? { gte: startOfDay(start) } : {}),
      ...(end ? { lte: endOfDay(end) } : {}),
    };
  }

  private buildFilters(
    contracts: DashboardContractOption[],
    links: DashboardEmploymentLink[],
  ) {
    return {
      contracts: contracts.map((contract) => ({
        value: contract.publicId,
        label: this.contractLabel(contract),
      })),
      units: this.uniqueSorted(
        links.map((link) => this.unitLabel(link)).filter(Boolean),
      ),
      departments: this.uniqueSorted(
        links.map((link) => this.departmentLabel(link)).filter(Boolean),
      ),
      positions: this.uniqueSorted(
        links.map((link) => link.position.name).filter(Boolean),
      ),
      regimes: this.uniqueSorted(
        links.map((link) => link.type).filter(Boolean),
      ),
    };
  }

  private matchesComputedFilters(
    link: DashboardEmploymentLink,
    filters: DashboardFilterInput,
  ) {
    if (filters.units.length > 0 && !filters.units.includes(this.unitLabel(link))) {
      return false;
    }

    if (
      filters.departments.length > 0 &&
      !filters.departments.includes(this.departmentLabel(link))
    ) {
      return false;
    }

    return true;
  }

  private mapLinkRow(link: DashboardEmploymentLink) {
    const employeeName = link.person.name;

    return {
      publicId: link.publicId,
      contractPublicId: link.contract.publicId,
      contractLabel: this.contractLabel(link.contract),
      employeeName,
      employeeInitials: this.initials(employeeName),
      email: link.person.email,
      registration: link.publicId,
      position: link.position.name,
      department: this.departmentLabel(link),
      unit: this.unitLabel(link),
      admissionDate: link.startsAt,
      regime: link.type,
      status: link.status,
      statusLabel: this.statusLabel(link.status),
    };
  }

  private serializePeriod(period: DashboardPeriod) {
    return {
      key: period.key,
      label: period.label,
      shortLabel: period.shortLabel,
      start: period.start,
      end: period.end,
    };
  }

  private contractLabel(contract: DashboardContractOption) {
    const providerName =
      contract.providerCompany.tradeName ?? contract.providerCompany.legalName;
    const typeName = contract.contractType?.name;
    const modelName = contract.contractModel?.name;
    const suffix = [typeName, modelName].filter(Boolean).join(" / ");

    return suffix
      ? `${providerName} -> ${contract.clientCompany.name} (${suffix})`
      : `${providerName} -> ${contract.clientCompany.name}`;
  }

  private departmentLabel(link: DashboardEmploymentLink) {
    return link.position.service.category ?? link.position.service.name;
  }

  private unitLabel(link: DashboardEmploymentLink) {
    return (
      link.position.location ??
      link.contract.clientCompany.name ??
      link.providerCompany.tradeName ??
      link.providerCompany.legalName
    );
  }

  private initials(name: string) {
    const parts = name
      .trim()
      .split(/\s+/)
      .filter((part) => part.length > 0);

    if (parts.length === 0) {
      return "PF";
    }

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  private statusLabel(status: EmploymentLinkStatus) {
    switch (status) {
      case EmploymentLinkStatus.ACTIVE:
        return "Ativo";
      case EmploymentLinkStatus.PENDING:
        return "Pendente";
      case EmploymentLinkStatus.SUSPENDED:
        return "Suspenso";
      case EmploymentLinkStatus.DISMISSED:
        return "Desligado";
      case EmploymentLinkStatus.BLOCKED:
        return "Bloqueado";
      default:
        return status;
    }
  }

  private uniqueCount(values: string[]) {
    return new Set(values).size;
  }

  private uniqueSorted(values: string[]) {
    return [
      ...new Set(values.map((value) => value.trim()).filter(Boolean)),
    ].sort((left, right) => left.localeCompare(right, "pt-BR"));
  }
}

const dashboardLinkInclude = {
  person: true,
  providerCompany: true,
  contract: {
    include: {
      clientCompany: true,
      providerCompany: true,
      contractType: true,
      contractModel: true,
    },
  },
  position: {
    include: {
      service: true,
    },
  },
} satisfies Prisma.EmploymentLinkInclude;

function parseCsvQuery(value: string | string[] | undefined): string[] {
  return queryValues(value)
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function firstQueryValue(value: string | string[] | undefined) {
  return queryValues(value)[0]?.trim();
}

function queryValues(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function parseDateOnly(value?: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function startOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfDay(date: Date) {
  const start = startOfDay(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

function addDays(date: Date, days: number) {
  const next = startOfDay(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = startOfDay(date);
  const targetMonth = next.getUTCMonth() + months;
  next.setUTCMonth(targetMonth);
  return next;
}

function formatShortDate(date: Date) {
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}
