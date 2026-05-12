import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  AttachmentStatus,
  CalendarEntryKind,
  CalendarEntryStatus,
  ContractDocumentStatus,
  EmploymentLinkStatus,
  Prisma,
} from "@prisma/client";
import { tenantWhere } from "../../common/tenant/tenant-scope";
import { PrismaService } from "../../infra/database/prisma.service";
import { AuthTokenPayload } from "../auth/interfaces/auth-token-payload.interface";
import { ExecuteReportDto } from "./dto/execute-report.dto";

type ReportFamily =
  | "strategic"
  | "management"
  | "controls"
  | "compliance"
  | "audit"
  | "automation";

type ReportStatus = "ready" | "planned";
type ReportValue = string | number | boolean | null;
type ReportRow = Record<string, ReportValue>;

interface ReportDefinition {
  title: string;
  family: ReportFamily;
  supported: boolean;
  plannedReason?: string;
}

interface ReportMetric {
  label: string;
  value: string;
}

interface ReportColumn {
  key: string;
  label: string;
}

interface ReportBuildResult {
  metrics: ReportMetric[];
  columns: ReportColumn[];
  rows: ReportRow[];
  notes?: string[];
}

interface DateRange {
  start?: Date;
  end?: Date;
}

interface ReportMetadata {
  generatedAt: string;
  generatedBy: {
    publicId: string;
    name: string;
    email: string | null;
  };
  linkedCompany: {
    publicId: string;
    name: string;
    type: "provider" | "client";
  } | null;
  permission: {
    level: string;
    profiles: string[];
  };
}

const reportRowLimit = 100;

const reportDefinitions: Record<string, ReportDefinition> = {
  strategic_executive_map: {
    title: "Mapa executivo",
    family: "strategic",
    supported: true,
  },
  strategic_trends: {
    title: "Tendencias operacionais",
    family: "strategic",
    supported: true,
  },
  strategic_network_risk: {
    title: "Risco da malha",
    family: "strategic",
    supported: true,
  },
  strategic_board_pack: {
    title: "Board pack",
    family: "strategic",
    supported: false,
    plannedReason:
      "O pacote de board depende do renderizador PDF e do agrupador de anexos executivos.",
  },
  management_employees: {
    title: "Quadro ativo",
    family: "management",
    supported: true,
  },
  management_hires: {
    title: "Admissoes",
    family: "management",
    supported: true,
  },
  management_dismissals: {
    title: "Desligados",
    family: "management",
    supported: true,
  },
  management_movements: {
    title: "Movimentacoes",
    family: "management",
    supported: true,
  },
  management_departments: {
    title: "Distribuicao",
    family: "management",
    supported: true,
  },
  management_indicators: {
    title: "Indicadores",
    family: "management",
    supported: true,
  },
  management_contracts: {
    title: "Relatorios gerenciais",
    family: "management",
    supported: true,
  },
  controls_documents: {
    title: "Pendencias documentais",
    family: "controls",
    supported: true,
  },
  controls_sla: {
    title: "SLA de rotinas",
    family: "controls",
    supported: false,
    plannedReason:
      "SLA depende de datas alvo por rotina e tabela de tarefas operacionais.",
  },
  controls_calendar: {
    title: "Agenda de compromissos e lembretes",
    family: "controls",
    supported: true,
  },
  controls_movements: {
    title: "Movimentacoes",
    family: "controls",
    supported: true,
  },
  controls_evidence: {
    title: "Anexos e evidencias",
    family: "controls",
    supported: true,
  },
  compliance_alerts: {
    title: "Alertas e compliance",
    family: "compliance",
    supported: true,
  },
  compliance_sensitive_access: {
    title: "Acessos sensiveis",
    family: "compliance",
    supported: true,
  },
  compliance_expirations: {
    title: "Vencimentos criticos",
    family: "compliance",
    supported: true,
  },
  compliance_exceptions: {
    title: "Excecoes operacionais",
    family: "compliance",
    supported: true,
  },
  audit_changes: {
    title: "Historico de alteracoes",
    family: "audit",
    supported: true,
  },
  audit_deletions: {
    title: "Historico de exclusoes",
    family: "audit",
    supported: true,
  },
  audit_additions: {
    title: "Historico de adicoes",
    family: "audit",
    supported: true,
  },
  audit_settings: {
    title: "Configuracoes do app",
    family: "audit",
    supported: true,
  },
  audit_sessions: {
    title: "Seguranca de sessoes",
    family: "audit",
    supported: true,
  },
  automation_management: {
    title: "Fechamento executivo",
    family: "automation",
    supported: false,
    plannedReason:
      "Automacoes dependem do modulo de jobs, calendario e destinatarios.",
  },
  automation_logs: {
    title: "Rotina de logs",
    family: "automation",
    supported: false,
    plannedReason:
      "A rotina periodica de logs depende do modulo de jobs e do canal de envio.",
  },
  automation_status: {
    title: "Status semanal",
    family: "automation",
    supported: false,
    plannedReason:
      "Status semanal depende do modulo de jobs e de snapshots operacionais.",
  },
  automation_controls: {
    title: "Trilha de controles",
    family: "automation",
    supported: false,
    plannedReason:
      "A trilha recorrente depende do modulo de controles e escalonamento.",
  },
};

@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async execute(dto: ExecuteReportDto, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    const definition = reportDefinitions[dto.templateId];
    if (!definition) {
      throw new BadRequestException("Template de relatorio nao reconhecido.");
    }

    if (!definition.supported) {
      return this.decorateReport(dto, actor, definition, {
        status: "planned",
        metrics: [],
        columns: [],
        rows: [],
        notes: [
          definition.plannedReason ??
            "Este relatorio ainda nao possui fonte de dados implementada.",
        ],
      });
    }

    const data = await this.buildReport(dto.templateId, dto.filters ?? {}, actor);
    return this.decorateReport(dto, actor, definition, {
      status: "ready",
      ...data,
    });
  }

  private async buildReport(
    templateId: string,
    filters: Record<string, unknown>,
    actor: AuthTokenPayload,
  ): Promise<ReportBuildResult> {
    switch (templateId) {
      case "strategic_executive_map":
      case "strategic_trends":
      case "management_indicators":
        return this.buildIndicatorsReport(actor);
      case "strategic_network_risk":
        return this.buildNetworkRiskReport(filters, actor);
      case "management_employees":
        return this.buildEmployeesReport(filters, actor);
      case "management_hires":
        return this.buildHiresReport(filters, actor);
      case "management_dismissals":
        return this.buildDismissalsReport(filters, actor);
      case "management_movements":
      case "controls_movements":
        return this.buildMovementsReport(filters, actor);
      case "management_departments":
        return this.buildDistributionReport(filters, actor);
      case "management_contracts":
        return this.buildContractsReport(filters, actor);
      case "controls_documents":
        return this.buildDocumentsReport(filters, actor);
      case "controls_calendar":
        return this.buildCalendarEntriesReport(filters, actor);
      case "controls_evidence":
        return this.buildEvidenceReport(filters, actor);
      case "compliance_alerts":
      case "compliance_exceptions":
        return this.buildComplianceOccurrencesReport(filters, actor);
      case "compliance_sensitive_access":
      case "audit_sessions":
        return this.buildSessionsReport(filters, actor);
      case "compliance_expirations":
        return this.buildExpirationsReport(filters, actor);
      case "audit_changes":
      case "audit_deletions":
      case "audit_additions":
      case "audit_settings":
        return this.buildAuditLogReport(templateId, filters, actor);
      default:
        return {
          metrics: [],
          columns: [],
          rows: [],
          notes: ["Relatorio ainda sem executor associado no backend."],
        };
    }
  }

  private async buildEmployeesReport(
    filters: Record<string, unknown>,
    actor: AuthTokenPayload,
  ): Promise<ReportBuildResult> {
    const statusFilter = this.employmentStatusFilter(filters);
    const people = await this.prisma.person.findMany({
      where: tenantWhere(actor, {} as Prisma.PersonWhereInput),
      take: reportRowLimit,
      orderBy: { name: "asc" },
      include: {
        links: {
          take: 1,
          orderBy: [{ startsAt: "desc" }, { id: "desc" }],
          include: {
            providerCompany: true,
            contract: { include: { clientCompany: true } },
            position: true,
          },
        },
        _count: {
          select: {
            links: true,
            occurrences: true,
            entityTags: true,
          },
        },
      },
    });

    let rows = people.map((person) => {
      const link = person.links[0];
      return {
        pessoa: person.name,
        cpf: person.cpf ?? "nao informado",
        email: person.email ?? "nao informado",
        status: link?.status ?? "SEM_VINCULO",
        empresa:
          link?.providerCompany.tradeName ??
          link?.providerCompany.legalName ??
          "",
        cliente: link?.contract.clientCompany.name ?? "",
        cargo: link?.position.name ?? "",
        inicio: this.formatDate(link?.startsAt),
        vinculos: person._count.links,
        ocorrencias: person._count.occurrences,
      };
    });

    if (statusFilter) {
      rows = rows.filter((row) => row.status === statusFilter);
    }

    rows = this.applyTextFilter(rows, filters, "Empresa", [
      "empresa",
      "cliente",
    ]);
    rows = this.applyTextFilter(rows, filters, "Cargo", ["cargo"]);
    rows = this.applyTextFilter(rows, filters, "Departamento", ["cargo"]);

    return {
      metrics: [
        { label: "Pessoas no recorte", value: `${rows.length}` },
        {
          label: "Com vinculo ativo",
          value: `${rows.filter((row) => row.status === EmploymentLinkStatus.ACTIVE).length}`,
        },
        {
          label: "Com ocorrencias",
          value: `${rows.filter((row) => Number(row.ocorrencias) > 0).length}`,
        },
      ],
      columns: [
        { key: "pessoa", label: "Pessoa" },
        { key: "status", label: "Status" },
        { key: "empresa", label: "Empresa" },
        { key: "cliente", label: "Cliente" },
        { key: "cargo", label: "Cargo" },
        { key: "inicio", label: "Inicio" },
      ],
      rows,
    };
  }

  private async buildHiresReport(
    filters: Record<string, unknown>,
    actor: AuthTokenPayload,
  ): Promise<ReportBuildResult> {
    const dateRange = this.dateRangeFromFilters(filters, ["Periodo"]);
    const statusFilter = this.employmentStatusFilter(filters);
    const where: Prisma.EmploymentLinkWhereInput = {};

    const startsAt = this.dateFilter(dateRange);
    if (startsAt) {
      where.startsAt = startsAt;
    }
    if (statusFilter) {
      where.status = statusFilter;
    }
    const links = await this.prisma.employmentLink.findMany({
      where: tenantWhere(actor, where),
      take: reportRowLimit,
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      include: {
        person: true,
        providerCompany: true,
        contract: { include: { clientCompany: true } },
        position: true,
      },
    });

    let rows = links.map((link) => ({
      pessoa: link.person.name,
      tipo: link.type,
      status: link.status,
      empresa: link.providerCompany.tradeName ?? link.providerCompany.legalName,
      cliente: link.contract.clientCompany.name,
      cargo: link.position.name,
      inicio: this.formatDate(link.startsAt),
    }));

    rows = this.applyTextFilter(rows, filters, "Empresa", [
      "empresa",
      "cliente",
    ]);
    rows = this.applyTextFilter(rows, filters, "Cargo", ["cargo"]);

    return {
      metrics: [
        { label: "Admissoes no recorte", value: `${rows.length}` },
        {
          label: "Pendentes",
          value: `${rows.filter((row) => row.status === EmploymentLinkStatus.PENDING).length}`,
        },
      ],
      columns: [
        { key: "pessoa", label: "Pessoa" },
        { key: "inicio", label: "Inicio" },
        { key: "empresa", label: "Empresa" },
        { key: "cliente", label: "Cliente" },
        { key: "cargo", label: "Cargo" },
        { key: "status", label: "Status" },
      ],
      rows,
    };
  }

  private async buildDismissalsReport(
    filters: Record<string, unknown>,
    actor: AuthTokenPayload,
  ): Promise<ReportBuildResult> {
    const dateRange = this.dateRangeFromFilters(filters, ["Periodo"]);
    const dismissedAt = this.dateFilter(dateRange);
    const where: Prisma.DismissalWhereInput = {};
    if (dismissedAt) {
      where.dismissedAt = dismissedAt;
    }

    const dismissals = await this.prisma.dismissal.findMany({
      where: this.scopedDismissalWhere(actor, where),
      take: reportRowLimit,
      orderBy: [{ dismissedAt: "desc" }, { id: "desc" }],
      include: {
        employmentLink: {
          include: {
            person: true,
            providerCompany: true,
            contract: { include: { clientCompany: true } },
            position: true,
          },
        },
      },
    });

    let rows = dismissals.map((dismissal) => {
      const link = dismissal.employmentLink;
      return {
        pessoa: link.person.name,
        data: this.formatDate(dismissal.dismissedAt),
        motivo: dismissal.reason,
        tipo: dismissal.dismissalType ?? "nao informado",
        empresa:
          link.providerCompany.tradeName ?? link.providerCompany.legalName,
        cliente: link.contract.clientCompany.name,
        cargo: link.position.name,
        pendencias: dismissal.pendingIssues ?? "",
      };
    });

    rows = this.applyTextFilter(rows, filters, "Empresa", [
      "empresa",
      "cliente",
    ]);
    rows = this.applyTextFilter(rows, filters, "Motivo", ["motivo", "tipo"]);
    rows = this.applyTextFilter(rows, filters, "Cargo", ["cargo"]);

    return {
      metrics: [
        { label: "Desligamentos", value: `${rows.length}` },
        {
          label: "Com pendencias",
          value: `${rows.filter((row) => !this.text(row.pendencias).isEmpty).length}`,
        },
      ],
      columns: [
        { key: "pessoa", label: "Pessoa" },
        { key: "data", label: "Data" },
        { key: "motivo", label: "Motivo" },
        { key: "empresa", label: "Empresa" },
        { key: "cliente", label: "Cliente" },
        { key: "cargo", label: "Cargo" },
      ],
      rows,
    };
  }

  private async buildMovementsReport(
    filters: Record<string, unknown>,
    actor: AuthTokenPayload,
  ): Promise<ReportBuildResult> {
    const dateRange = this.dateRangeFromFilters(filters, ["Periodo"]);
    const movedAt = this.dateFilter(dateRange);
    const where: Prisma.EmploymentMoveWhereInput = {};
    if (movedAt) {
      where.movedAt = movedAt;
    }

    const moves = await this.prisma.employmentMove.findMany({
      where: this.scopedEmploymentMoveWhere(actor, where),
      take: reportRowLimit,
      orderBy: [{ movedAt: "desc" }, { id: "desc" }],
      include: {
        employmentLink: {
          include: {
            person: true,
            providerCompany: true,
            contract: { include: { clientCompany: true } },
            position: true,
          },
        },
      },
    });

    let rows = moves.map((move) => {
      const link = move.employmentLink;
      return {
        pessoa: link.person.name,
        tipo: move.moveType,
        data: this.formatDate(move.movedAt),
        origem: move.origin ?? "",
        destino: move.destination ?? "",
        empresa:
          link.providerCompany.tradeName ?? link.providerCompany.legalName,
        cliente: link.contract.clientCompany.name,
        cargo: link.position.name,
      };
    });

    rows = this.applyOptionFilter(rows, filters, "Tipo", "tipo");
    rows = this.applyTextFilter(rows, filters, "Origem", ["origem"]);
    rows = this.applyTextFilter(rows, filters, "Destino", ["destino"]);
    rows = this.applyTextFilter(rows, filters, "Responsavel", ["empresa"]);

    return {
      metrics: [
        { label: "Movimentacoes", value: `${rows.length}` },
        {
          label: "Com destino",
          value: `${rows.filter((row) => !this.text(row.destino).isEmpty).length}`,
        },
      ],
      columns: [
        { key: "pessoa", label: "Pessoa" },
        { key: "tipo", label: "Tipo" },
        { key: "data", label: "Data" },
        { key: "origem", label: "Origem" },
        { key: "destino", label: "Destino" },
        { key: "cliente", label: "Cliente" },
      ],
      rows,
    };
  }

  private async buildDistributionReport(
    filters: Record<string, unknown>,
    actor: AuthTokenPayload,
  ): Promise<ReportBuildResult> {
    const positions = await this.prisma.position.findMany({
      where: tenantWhere(actor, {} as Prisma.PositionWhereInput),
      take: reportRowLimit,
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        service: true,
        contract: {
          include: {
            providerCompany: true,
            clientCompany: true,
          },
        },
        _count: {
          select: {
            links: true,
            occurrences: true,
          },
        },
      },
    });

    let rows = positions.map((position) => ({
      departamento: position.service.category ?? position.service.name,
      cargo: position.name,
      servico: position.service.name,
      empresa:
        position.contract.providerCompany.tradeName ??
        position.contract.providerCompany.legalName,
      cliente: position.contract.clientCompany.name,
      status: position.status,
      vinculos: position._count.links,
      ocorrencias: position._count.occurrences,
    }));

    rows = this.applyTextFilter(rows, filters, "Departamento", [
      "departamento",
      "servico",
    ]);
    rows = this.applyTextFilter(rows, filters, "Cargo", ["cargo"]);
    rows = this.applyTextFilter(rows, filters, "Empresa", [
      "empresa",
      "cliente",
    ]);
    rows = this.applyOptionFilter(rows, filters, "Status", "status");

    return {
      metrics: [
        { label: "Postos no recorte", value: `${rows.length}` },
        {
          label: "Vinculos relacionados",
          value: `${rows.reduce((sum, row) => sum + Number(row.vinculos), 0)}`,
        },
      ],
      columns: [
        { key: "departamento", label: "Departamento" },
        { key: "cargo", label: "Cargo" },
        { key: "empresa", label: "Empresa" },
        { key: "cliente", label: "Cliente" },
        { key: "status", label: "Status" },
        { key: "vinculos", label: "Vinculos" },
      ],
      rows,
    };
  }

  private async buildIndicatorsReport(
    actor: AuthTokenPayload,
  ): Promise<ReportBuildResult> {
    const now = new Date();
    const inSixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const [
      people,
      activeLinks,
      contracts,
      activeContracts,
      openOccurrences,
      activeAttachments,
      activeDocuments,
      contractsNearEnd,
    ] = await Promise.all([
      this.prisma.person.count({
        where: tenantWhere(actor, {} as Prisma.PersonWhereInput),
      }),
      this.prisma.employmentLink.count({
        where: tenantWhere(actor, { status: EmploymentLinkStatus.ACTIVE }),
      }),
      this.prisma.contract.count({
        where: tenantWhere(actor, {} as Prisma.ContractWhereInput),
      }),
      this.prisma.contract.count({
        where: tenantWhere(actor, { status: "ACTIVE" }),
      }),
      this.prisma.occurrence.count({
        where: tenantWhere(actor, { status: "ACTIVE" }),
      }),
      this.prisma.attachment.count({
        where: tenantWhere(actor, { status: AttachmentStatus.ACTIVE }),
      }),
      this.prisma.contractDocument.count({
        where: this.scopedContractDocumentWhere(actor, {
          status: ContractDocumentStatus.ACTIVE,
        }),
      }),
      this.prisma.contract.count({
        where: tenantWhere(actor, {
          endsAt: {
            gte: now,
            lte: inSixtyDays,
          },
        }),
      }),
    ]);

    const rows = [
      {
        indicador: "Pessoas cadastradas",
        valor: people,
        detalhe: "Base de pessoas",
      },
      {
        indicador: "Vinculos ativos",
        valor: activeLinks,
        detalhe: "Vinculos com status ACTIVE",
      },
      {
        indicador: "Contratos ativos",
        valor: activeContracts,
        detalhe: `${contracts} contratos totais`,
      },
      {
        indicador: "Ocorrencias abertas",
        valor: openOccurrences,
        detalhe: "Ocorrencias com status ACTIVE",
      },
      {
        indicador: "Evidencias ativas",
        valor: activeAttachments + activeDocuments,
        detalhe: `${activeAttachments} anexos e ${activeDocuments} documentos`,
      },
      {
        indicador: "Contratos a vencer",
        valor: contractsNearEnd,
        detalhe: "Janela padrao de 60 dias",
      },
    ];

    return {
      metrics: [
        { label: "Pessoas", value: `${people}` },
        { label: "Vinculos ativos", value: `${activeLinks}` },
        { label: "Contratos ativos", value: `${activeContracts}` },
      ],
      columns: [
        { key: "indicador", label: "Indicador" },
        { key: "valor", label: "Valor" },
        { key: "detalhe", label: "Detalhe" },
      ],
      rows,
    };
  }

  private async buildNetworkRiskReport(
    filters: Record<string, unknown>,
    actor: AuthTokenPayload,
  ): Promise<ReportBuildResult> {
    const contracts = await this.prisma.contract.findMany({
      where: tenantWhere(actor, {} as Prisma.ContractWhereInput),
      take: reportRowLimit,
      orderBy: [{ status: "asc" }, { startsAt: "desc" }],
      include: {
        providerCompany: true,
        clientCompany: true,
        positions: {
          include: {
            service: true,
            _count: {
              select: {
                links: true,
                occurrences: true,
              },
            },
          },
        },
        _count: {
          select: {
            links: true,
            documents: true,
          },
        },
      },
    });

    let rows = contracts.map((contract) => {
      const occurrenceCount = contract.positions.reduce(
        (sum, position) => sum + position._count.occurrences,
        0,
      );
      return {
        contrato: contract.publicId,
        cliente: contract.clientCompany.name,
        prestadora:
          contract.providerCompany.tradeName ??
          contract.providerCompany.legalName,
        status: contract.status,
        postos: contract.positions.length,
        vinculos: contract._count.links,
        documentos: contract._count.documents,
        ocorrencias: occurrenceCount,
        criticidade:
          occurrenceCount > 2 || contract._count.links > 20
            ? "Alta"
            : occurrenceCount > 0
              ? "Media"
              : "Baixa",
      };
    });

    rows = this.applyTextFilter(rows, filters, "Grupo", [
      "prestadora",
      "cliente",
    ]);
    rows = this.applyTextFilter(rows, filters, "Cliente", ["cliente"]);
    rows = this.applyTextFilter(rows, filters, "Contrato", ["contrato"]);
    rows = this.applyOptionFilter(rows, filters, "Status", "status");
    rows = this.applyOptionFilter(rows, filters, "Criticidade", "criticidade");

    return {
      metrics: [
        { label: "Contratos analisados", value: `${rows.length}` },
        {
          label: "Criticidade alta",
          value: `${rows.filter((row) => row.criticidade === "Alta").length}`,
        },
      ],
      columns: [
        { key: "contrato", label: "Contrato" },
        { key: "cliente", label: "Cliente" },
        { key: "prestadora", label: "Prestadora" },
        { key: "criticidade", label: "Criticidade" },
        { key: "vinculos", label: "Vinculos" },
        { key: "ocorrencias", label: "Ocorrencias" },
      ],
      rows,
    };
  }

  private async buildContractsReport(
    filters: Record<string, unknown>,
    actor: AuthTokenPayload,
  ): Promise<ReportBuildResult> {
    const dateRange = this.dateRangeFromFilters(filters, [
      "Vigencia",
      "Periodo",
    ]);
    const where: Prisma.ContractWhereInput = {};
    const startsAt = this.dateFilter(dateRange);
    if (startsAt) {
      where.startsAt = startsAt;
    }

    const contracts = await this.prisma.contract.findMany({
      where: tenantWhere(actor, where),
      take: reportRowLimit,
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      include: {
        providerCompany: true,
        clientCompany: true,
        contractType: true,
        contractModel: true,
        _count: {
          select: {
            positions: true,
            documents: true,
            links: true,
          },
        },
      },
    });

    let rows = contracts.map((contract) => ({
      contrato: contract.publicId,
      prestadora:
        contract.providerCompany.tradeName ??
        contract.providerCompany.legalName,
      cliente: contract.clientCompany.name,
      tipo: contract.contractType?.name ?? "nao informado",
      modelo: contract.contractModel?.name ?? "nao informado",
      status: contract.status,
      inicio: this.formatDate(contract.startsAt),
      fim: this.formatDate(contract.endsAt),
      postos: contract._count.positions,
      documentos: contract._count.documents,
      vinculos: contract._count.links,
    }));

    rows = this.applyTextFilter(rows, filters, "Grupo", [
      "prestadora",
      "cliente",
    ]);
    rows = this.applyTextFilter(rows, filters, "Cliente", ["cliente"]);
    rows = this.applyOptionFilter(rows, filters, "Status", "status");

    return {
      metrics: [
        { label: "Contratos", value: `${rows.length}` },
        {
          label: "Ativos",
          value: `${rows.filter((row) => row.status === "ACTIVE").length}`,
        },
        {
          label: "Postos",
          value: `${rows.reduce((sum, row) => sum + Number(row.postos), 0)}`,
        },
      ],
      columns: [
        { key: "contrato", label: "Contrato" },
        { key: "cliente", label: "Cliente" },
        { key: "prestadora", label: "Prestadora" },
        { key: "status", label: "Status" },
        { key: "inicio", label: "Inicio" },
        { key: "fim", label: "Fim" },
        { key: "postos", label: "Postos" },
      ],
      rows,
    };
  }

  private async buildDocumentsReport(
    filters: Record<string, unknown>,
    actor: AuthTokenPayload,
  ): Promise<ReportBuildResult> {
    const documents = await this.prisma.contractDocument.findMany({
      where: this.scopedContractDocumentWhere(actor, {
        status: ContractDocumentStatus.ACTIVE,
      }),
      take: reportRowLimit,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        contract: {
          include: {
            providerCompany: true,
            clientCompany: true,
          },
        },
      },
    });

    let rows = documents.map((document) => ({
      documento: document.title,
      classificacao: document.classification,
      contrato: document.contract.publicId,
      cliente: document.contract.clientCompany.name,
      prestadora:
        document.contract.providerCompany.tradeName ??
        document.contract.providerCompany.legalName,
      status: document.status,
      arquivo:
        document.fileName ??
        document.externalLink ??
        document.physicalLocation ??
        "",
      criadoEm: this.formatDate(document.createdAt),
    }));

    rows = this.applyTextFilter(rows, filters, "Documento", [
      "documento",
      "arquivo",
    ]);
    rows = this.applyTextFilter(rows, filters, "Pessoa", ["cliente"]);
    rows = this.applyTextFilter(rows, filters, "Empresa", [
      "prestadora",
      "cliente",
    ]);
    rows = this.applyOptionFilter(rows, filters, "Severidade", "classificacao");

    return {
      metrics: [
        { label: "Documentos ativos", value: `${rows.length}` },
        {
          label: "Com arquivo/link",
          value: `${rows.filter((row) => !this.text(row.arquivo).isEmpty).length}`,
        },
      ],
      columns: [
        { key: "documento", label: "Documento" },
        { key: "classificacao", label: "Classificacao" },
        { key: "contrato", label: "Contrato" },
        { key: "cliente", label: "Cliente" },
        { key: "prestadora", label: "Prestadora" },
        { key: "criadoEm", label: "Criado em" },
      ],
      rows,
      notes: [
        "Vencimento documental ainda depende de campo especifico no modelo de documentos.",
      ],
    };
  }

  private async buildCalendarEntriesReport(
    filters: Record<string, unknown>,
    actor: AuthTokenPayload,
  ): Promise<ReportBuildResult> {
    const requestedDateRange = this.dateRangeFromFilters(filters, ["Periodo"]);
    const dateRange = requestedDateRange ?? this.defaultFutureRange(30);
    const startsAt = this.dateFilter(dateRange);
    const kindFilter = this.calendarKindFilter(filters);
    const statusFilter = this.calendarStatusFilter(filters);
    const where: Prisma.CalendarEntryWhereInput = {};

    if (startsAt) {
      where.startsAt = startsAt;
    }
    if (kindFilter) {
      where.kind = kindFilter;
    }
    if (statusFilter) {
      where.status = statusFilter;
    }
    const regionFilter =
      this.filterValue(filters, "Regiao calendario") ??
      this.filterValue(filters, "Regiao");
    const stateFilter =
      this.filterValue(filters, "Estado") ?? this.filterValue(filters, "UF");
    const cityFilter = this.filterValue(filters, "Cidade");
    if (regionFilter) {
      where.appliesToRegionCode = regionFilter.trim().toUpperCase();
    }
    if (stateFilter) {
      where.appliesToStateCode = stateFilter.trim().toUpperCase();
    }
    if (cityFilter) {
      where.appliesToCityName = { contains: cityFilter.trim() };
    }

    const entries = await this.prisma.calendarEntry.findMany({
      where: tenantWhere(actor, where),
      take: reportRowLimit,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      include: {
        person: true,
        providerCompany: true,
        clientCompany: true,
        contract: {
          include: {
            providerCompany: true,
            clientCompany: true,
          },
        },
        employmentLink: {
          include: {
            person: true,
            providerCompany: true,
            contract: {
              include: {
                clientCompany: true,
              },
            },
            position: true,
          },
        },
        position: true,
        createdByUserSystem: true,
        assignedToUserSystem: true,
      },
    });

    const now = new Date();
    let rows = entries.map((entry): ReportRow => {
      const providerName =
        entry.providerCompany?.tradeName ??
        entry.providerCompany?.legalName ??
        entry.contract?.providerCompany.tradeName ??
        entry.contract?.providerCompany.legalName ??
        entry.employmentLink?.providerCompany.tradeName ??
        entry.employmentLink?.providerCompany.legalName ??
        "";
      const clientName =
        entry.clientCompany?.name ??
        entry.contract?.clientCompany.name ??
        entry.employmentLink?.contract.clientCompany.name ??
        "";
      const company = [providerName, clientName]
        .filter((value) => !this.text(value).isEmpty)
        .join(" / ");
      const contractId =
        entry.contract?.publicId ?? entry.employmentLink?.contract.publicId ?? "";
      const companyTarget = company || undefined;
      const contractTarget = contractId ? `Contrato ${contractId}` : undefined;
      const target =
        entry.person?.name ??
        entry.employmentLink?.person.name ??
        entry.position?.name ??
        entry.employmentLink?.position.name ??
        contractTarget ??
        companyTarget ??
        "Geral";
      const assignee =
        entry.assignedToUserSystem?.name ??
        entry.assignedToUserSystem?.email ??
        "";
      const createdBy =
        entry.createdByUserSystem?.name ??
        entry.createdByUserSystem?.email ??
        "";
      const overdue =
        entry.status === CalendarEntryStatus.SCHEDULED &&
        entry.startsAt.getTime() < now.getTime();

      return {
        dataHora: this.formatDateTime(entry.startsAt),
        fim: this.formatDateTimeNullable(entry.endsAt),
        tipo: this.calendarKindLabel(entry.kind),
        titulo: entry.title,
        status: overdue
          ? `${this.calendarStatusLabel(entry.status)} (atrasado)`
          : this.calendarStatusLabel(entry.status),
        prioridade: this.calendarPriorityLabel(entry.priority),
        vinculo: target,
        empresa: company || "nao vinculada",
        contrato: contractId,
        responsavel: assignee || "nao atribuido",
        criadoPor: createdBy || "sistema",
        notificacao: this.formatDateTimeNullable(entry.notificationScheduledAt),
        canal: this.calendarChannelsLabel(entry.notificationChannelsJson),
        politica: this.calendarNotificationPolicyLabel(
          entry.notificationPolicy,
          entry.notificationOffsetBusinessDays,
        ),
        diaNaoUtil: this.nonBusinessDayLabel(
          entry.startsAt,
          entry.holidayRegionCode,
        ),
        aplicabilidade: this.calendarApplicabilityLabel(
          entry.appliesToRegionCode,
          entry.appliesToStateCode,
          entry.appliesToCityName,
        ),
      };
    });

    rows = this.applyTextFilter(rows, filters, "Empresa", ["empresa"]);
    rows = this.applyTextFilter(rows, filters, "Contrato", [
      "contrato",
      "vinculo",
    ]);
    rows = this.applyTextFilter(rows, filters, "Pessoa", ["vinculo"]);
    rows = this.applyTextFilter(rows, filters, "Responsavel", [
      "responsavel",
      "criadoPor",
    ]);
    rows = this.applyTextFilter(rows, filters, "Vinculo", [
      "vinculo",
      "empresa",
      "contrato",
    ]);
    rows = this.applyTextFilter(rows, filters, "Aplicabilidade", [
      "aplicabilidade",
    ]);

    return {
      metrics: [
        { label: "Itens no periodo", value: `${rows.length}` },
        {
          label: "Lembretes",
          value: `${rows.filter((row) => row.tipo === "Lembrete").length}`,
        },
        {
          label: "Compromissos",
          value: `${rows.filter((row) => row.tipo === "Compromisso").length}`,
        },
        {
          label: "Dias nao uteis",
          value: `${
            rows.filter((row) => row.diaNaoUtil !== "Dia util").length
          }`,
        },
      ],
      columns: [
        { key: "dataHora", label: "Data e hora" },
        { key: "tipo", label: "Tipo" },
        { key: "titulo", label: "Titulo" },
        { key: "status", label: "Status" },
        { key: "vinculo", label: "Vinculo" },
        { key: "empresa", label: "Empresa" },
        { key: "responsavel", label: "Responsavel" },
        { key: "notificacao", label: "Notificacao" },
        { key: "canal", label: "Canal" },
        { key: "diaNaoUtil", label: "Dia nao util" },
        { key: "aplicabilidade", label: "Aplicabilidade" },
      ],
      rows,
      notes: [
        ...(requestedDateRange
          ? []
          : ["Sem periodo informado, o relatorio usa os proximos 30 dias."]),
        "Finais de semana sao calculados pela data; feriados usam o codigo de regiao gravado no item da agenda.",
      ],
    };
  }

  private async buildEvidenceReport(
    filters: Record<string, unknown>,
    actor: AuthTokenPayload,
  ): Promise<ReportBuildResult> {
    const [attachments, documents] = await Promise.all([
      this.prisma.attachment.findMany({
        where: tenantWhere(actor, { status: AttachmentStatus.ACTIVE }),
        take: Math.floor(reportRowLimit / 2),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          occurrence: {
            include: {
              person: true,
              providerCompany: true,
            },
          },
        },
      }),
      this.prisma.contractDocument.findMany({
        where: this.scopedContractDocumentWhere(actor, {
          status: ContractDocumentStatus.ACTIVE,
        }),
        take: Math.floor(reportRowLimit / 2),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          contract: {
            include: {
              providerCompany: true,
              clientCompany: true,
            },
          },
        },
      }),
    ]);

    let rows: ReportRow[] = [
      ...attachments.map((attachment) => ({
        origem: "Anexo de ocorrencia",
        titulo: attachment.fileName,
        classificacao: attachment.classification,
        modulo: "Pessoas",
        vinculo: attachment.occurrence.person.name,
        contexto:
          attachment.occurrence.providerCompany?.tradeName ??
          attachment.occurrence.providerCompany?.legalName ??
          attachment.occurrence.title,
        status: attachment.status,
        criadoEm: this.formatDate(attachment.createdAt),
      })),
      ...documents.map((document) => ({
        origem: "Documento de contrato",
        titulo: document.title,
        classificacao: document.classification,
        modulo: "Contratos",
        vinculo: document.contract.publicId,
        contexto: document.contract.clientCompany.name,
        status: document.status,
        criadoEm: this.formatDate(document.createdAt),
      })),
    ];

    rows = this.applyOptionFilter(rows, filters, "Modulo", "modulo");
    rows = this.applyOptionFilter(rows, filters, "Tipo", "origem");
    rows = this.applyTextFilter(rows, filters, "Pessoa", ["vinculo"]);
    rows = this.applyTextFilter(rows, filters, "Contrato", ["vinculo"]);
    rows = this.applyOptionFilter(rows, filters, "Revisao", "status");

    return {
      metrics: [
        { label: "Evidencias", value: `${rows.length}` },
        {
          label: "Anexos",
          value: `${rows.filter((row) => row.origem === "Anexo de ocorrencia").length}`,
        },
        {
          label: "Docs contrato",
          value: `${rows.filter((row) => row.origem === "Documento de contrato").length}`,
        },
      ],
      columns: [
        { key: "origem", label: "Origem" },
        { key: "titulo", label: "Titulo" },
        { key: "classificacao", label: "Classificacao" },
        { key: "modulo", label: "Modulo" },
        { key: "vinculo", label: "Vinculo" },
        { key: "criadoEm", label: "Criado em" },
      ],
      rows,
    };
  }

  private async buildComplianceOccurrencesReport(
    filters: Record<string, unknown>,
    actor: AuthTokenPayload,
  ): Promise<ReportBuildResult> {
    const dateRange = this.dateRangeFromFilters(filters, ["Periodo"]);
    const occurredAt = this.dateFilter(dateRange);
    const where: Prisma.OccurrenceWhereInput = {};
    if (occurredAt) {
      where.occurredAt = occurredAt;
    }

    const occurrences = await this.prisma.occurrence.findMany({
      where: tenantWhere(actor, where),
      take: reportRowLimit,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      include: {
        person: true,
        providerCompany: true,
        position: true,
        _count: {
          select: {
            attachments: true,
            receipts: true,
          },
        },
      },
    });

    let rows = occurrences.map((occurrence) => ({
      regra: occurrence.type,
      titulo: occurrence.title,
      pessoa: occurrence.person.name,
      empresa:
        occurrence.providerCompany?.tradeName ??
        occurrence.providerCompany?.legalName ??
        "",
      modulo: occurrence.scope,
      criticidade: occurrence.severityLevel,
      visibilidade: occurrence.visibility,
      natureza: occurrence.nature,
      status: occurrence.status,
      data: this.formatDate(occurrence.occurredAt),
      anexos: occurrence._count.attachments,
    }));

    rows = this.applyTextFilter(rows, filters, "Regra", ["regra", "titulo"]);
    rows = this.applyOptionFilter(rows, filters, "Criticidade", "criticidade");
    rows = this.applyOptionFilter(rows, filters, "Modulo", "modulo");
    rows = this.applyTextFilter(rows, filters, "Dono", ["pessoa", "empresa"]);
    rows = this.applyTextFilter(rows, filters, "Responsavel", [
      "pessoa",
      "empresa",
    ]);

    return {
      metrics: [
        { label: "Eventos", value: `${rows.length}` },
        {
          label: "Criticos",
          value: `${rows.filter((row) => this.normalized(row.criticidade).includes("crit")).length}`,
        },
        {
          label: "Com anexos",
          value: `${rows.filter((row) => Number(row.anexos) > 0).length}`,
        },
      ],
      columns: [
        { key: "regra", label: "Regra" },
        { key: "titulo", label: "Titulo" },
        { key: "pessoa", label: "Pessoa" },
        { key: "empresa", label: "Empresa" },
        { key: "criticidade", label: "Criticidade" },
        { key: "data", label: "Data" },
      ],
      rows,
    };
  }

  private async buildExpirationsReport(
    filters: Record<string, unknown>,
    actor: AuthTokenPayload,
  ): Promise<ReportBuildResult> {
    const dateRange =
      this.dateRangeFromFilters(filters, ["Janela", "Vencimento"]) ??
      this.defaultFutureRange(60);
    const where: Prisma.ContractWhereInput = {
      endsAt: this.dateFilter(dateRange),
    };

    const contracts = await this.prisma.contract.findMany({
      where: tenantWhere(actor, where),
      take: reportRowLimit,
      orderBy: [{ endsAt: "asc" }, { id: "asc" }],
      include: {
        providerCompany: true,
        clientCompany: true,
        _count: {
          select: {
            documents: true,
            links: true,
          },
        },
      },
    });

    let rows = contracts.map((contract) => ({
      tipo: "Contrato",
      contrato: contract.publicId,
      cliente: contract.clientCompany.name,
      prestadora:
        contract.providerCompany.tradeName ??
        contract.providerCompany.legalName,
      vencimento: this.formatDate(contract.endsAt),
      status: contract.status,
      severidade: this.expirationSeverity(contract.endsAt),
      documentos: contract._count.documents,
      vinculos: contract._count.links,
    }));

    rows = this.applyTextFilter(rows, filters, "Cliente", ["cliente"]);
    rows = this.applyTextFilter(rows, filters, "Contrato", ["contrato"]);
    rows = this.applyOptionFilter(rows, filters, "Severidade", "severidade");

    return {
      metrics: [
        { label: "Vencimentos", value: `${rows.length}` },
        {
          label: "Criticos",
          value: `${rows.filter((row) => row.severidade === "Critico").length}`,
        },
      ],
      columns: [
        { key: "tipo", label: "Tipo" },
        { key: "contrato", label: "Contrato" },
        { key: "cliente", label: "Cliente" },
        { key: "prestadora", label: "Prestadora" },
        { key: "vencimento", label: "Vencimento" },
        { key: "severidade", label: "Severidade" },
      ],
      rows,
      notes: [
        "Documentos ainda nao possuem data de vencimento no schema; o recorte usa vigencia de contratos.",
      ],
    };
  }

  private async buildAuditLogReport(
    templateId: string,
    filters: Record<string, unknown>,
    actor: AuthTokenPayload,
  ): Promise<ReportBuildResult> {
    const dateRange = this.dateRangeFromFilters(filters, ["Periodo"]);
    const createdAt = this.dateFilter(dateRange);
    const where: Prisma.AuditLogWhereInput = {};
    if (createdAt) {
      where.createdAt = createdAt;
    }

    const logs = await this.prisma.auditLog.findMany({
      where: tenantWhere(actor, where),
      take: reportRowLimit,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        userSystem: true,
      },
    });

    let rows: ReportRow[] = logs.map((log) => ({
      data: this.formatDateTime(log.createdAt),
      usuario: log.userSystem?.name ?? log.userSystem?.email ?? "sistema",
      modulo: log.entityName,
      entidade: log.entityPublicId ?? "",
      acao: log.action,
      descricao: log.description ?? "",
      origem: log.ipAddress ?? "",
      dispositivo: log.device ?? "",
    }));

    rows = this.filterAuditRows(templateId, rows);
    rows = this.applyOptionFilter(rows, filters, "Modulo", "modulo");
    rows = this.applyTextFilter(rows, filters, "Usuario", ["usuario"]);
    rows = this.applyTextFilter(rows, filters, "Criado por", ["usuario"]);
    rows = this.applyTextFilter(rows, filters, "Entidade", ["entidade"]);
    rows = this.applyTextFilter(rows, filters, "Parametro", ["entidade"]);

    return {
      metrics: [
        { label: "Eventos", value: `${rows.length}` },
        {
          label: "Usuarios",
          value: `${new Set(rows.map((row) => row.usuario)).size}`,
        },
      ],
      columns: [
        { key: "data", label: "Data" },
        { key: "usuario", label: "Usuario" },
        { key: "modulo", label: "Modulo" },
        { key: "acao", label: "Acao" },
        { key: "entidade", label: "Entidade" },
        { key: "descricao", label: "Descricao" },
      ],
      rows,
      notes: [
        "A trilha usa log_auditoria. Modulos que ainda nao gravam auditoria aparecem apenas quando passarem a registrar eventos.",
      ],
    };
  }

  private async buildSessionsReport(
    filters: Record<string, unknown>,
    actor: AuthTokenPayload,
  ): Promise<ReportBuildResult> {
    const dateRange = this.dateRangeFromFilters(filters, ["Periodo"]);
    const createdAt = this.dateFilter(dateRange);
    const where: Prisma.SecurityEventWhereInput = {};
    if (createdAt) {
      where.createdAt = createdAt;
    }

    const events = await this.prisma.securityEvent.findMany({
      where: tenantWhere(actor, where),
      take: reportRowLimit,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        userSystem: true,
      },
    });

    let rows = events.map((event) => ({
      data: this.formatDateTime(event.createdAt),
      usuario: event.userSystem?.name ?? event.userSystem?.email ?? "sistema",
      evento: event.eventType,
      resultado: event.eventType.includes("FAILURE") ? "Falha" : "Permitido",
      origem: event.ipAddress ?? "",
      dispositivo: event.userAgent ?? "",
      descricao: event.description,
    }));

    rows = this.applyTextFilter(rows, filters, "Usuario", ["usuario"]);
    rows = this.applyOptionFilter(rows, filters, "Evento", "evento");
    rows = this.applyOptionFilter(rows, filters, "Resultado", "resultado");
    rows = this.applyTextFilter(rows, filters, "Origem", ["origem"]);
    rows = this.applyOptionFilter(rows, filters, "Perfil", "descricao");
    rows = this.applyTextFilter(rows, filters, "Recurso", ["descricao"]);

    return {
      metrics: [
        { label: "Eventos de sessao", value: `${rows.length}` },
        {
          label: "Falhas",
          value: `${rows.filter((row) => row.resultado === "Falha").length}`,
        },
      ],
      columns: [
        { key: "data", label: "Data" },
        { key: "usuario", label: "Usuario" },
        { key: "evento", label: "Evento" },
        { key: "resultado", label: "Resultado" },
        { key: "origem", label: "Origem" },
        { key: "descricao", label: "Descricao" },
      ],
      rows,
      notes: [
        "Sessoes sensiveis e refresh tokens ja existem no schema; o relatorio inicial usa security_events como fonte auditavel.",
      ],
    };
  }

  private scopedDismissalWhere(
    actor: AuthTokenPayload,
    where: Prisma.DismissalWhereInput,
  ): Prisma.DismissalWhereInput {
    const employmentLinkScope = this.employmentLinkTenantScope(actor);
    return employmentLinkScope
      ? { AND: [where, { employmentLink: { is: employmentLinkScope } }] }
      : where;
  }

  private scopedEmploymentMoveWhere(
    actor: AuthTokenPayload,
    where: Prisma.EmploymentMoveWhereInput,
  ): Prisma.EmploymentMoveWhereInput {
    const employmentLinkScope = this.employmentLinkTenantScope(actor);
    return employmentLinkScope
      ? { AND: [where, { employmentLink: { is: employmentLinkScope } }] }
      : where;
  }

  private scopedContractDocumentWhere(
    actor: AuthTokenPayload,
    where: Prisma.ContractDocumentWhereInput,
  ): Prisma.ContractDocumentWhereInput {
    const contractScope = this.contractTenantScope(actor);
    return contractScope
      ? { AND: [where, { contract: { is: contractScope } }] }
      : where;
  }

  private employmentLinkTenantScope(
    actor: AuthTokenPayload,
  ): Prisma.EmploymentLinkWhereInput | undefined {
    return this.nonEmptyScope(
      tenantWhere(actor, {} as Prisma.EmploymentLinkWhereInput),
    );
  }

  private contractTenantScope(
    actor: AuthTokenPayload,
  ): Prisma.ContractWhereInput | undefined {
    return this.nonEmptyScope(tenantWhere(actor, {} as Prisma.ContractWhereInput));
  }

  private nonEmptyScope<TWhere extends object>(
    where: TWhere | undefined,
  ): TWhere | undefined {
    return where && Object.keys(where).length > 0 ? where : undefined;
  }

  private async decorateReport(
    dto: ExecuteReportDto,
    actor: AuthTokenPayload,
    definition: ReportDefinition,
    data: ReportBuildResult & { status: ReportStatus },
  ) {
    const notes = [...(data.notes ?? []), ...this.deliveryNotes(dto.delivery)];
    const csv =
      data.status === "ready" ? this.toCsv(data.columns, data.rows) : "";
    const generatedAt = new Date();
    const metadata = await this.resolveReportMetadata(actor, generatedAt);

    return {
      templateId: dto.templateId,
      title: definition.title,
      family: definition.family,
      status: data.status,
      generatedAt: metadata.generatedAt,
      requestedBy: `${metadata.generatedBy.name} (${metadata.generatedBy.publicId})`,
      metadata,
      delivery: dto.delivery ?? "Painel",
      frequency: dto.frequency ?? "Manual",
      metrics: data.metrics,
      columns: data.columns,
      rows: data.rows,
      csv,
      notes,
    };
  }

  private async resolveReportMetadata(
    actor: AuthTokenPayload,
    generatedAt: Date,
  ): Promise<ReportMetadata> {
    const user = await this.prisma.userSystem.findUnique({
      where: { publicId: actor.sub },
      include: {
        providerCompany: true,
        clientCompany: true,
        accessProfiles: {
          include: {
            accessProfile: true,
          },
        },
      },
    });

    const providerCompany = user?.providerCompany;
    const clientCompany = user?.clientCompany;
    const linkedCompany = providerCompany
      ? {
          publicId: providerCompany.publicId,
          name: providerCompany.tradeName ?? providerCompany.legalName,
          type: "provider" as const,
        }
      : clientCompany
        ? {
            publicId: clientCompany.publicId,
            name: clientCompany.name,
            type: "client" as const,
          }
        : null;
    const profiles = user
      ? user.accessProfiles.map(
          (profile) => profile.accessProfile.name || profile.accessProfile.code,
        )
      : actor.profiles;

    return {
      generatedAt: generatedAt.toISOString(),
      generatedBy: {
        publicId: user?.publicId ?? actor.sub,
        name: user?.name ?? actor.email ?? actor.sub,
        email: user?.email ?? actor.email,
      },
      linkedCompany,
      permission: {
        level: this.permissionLevelLabel(actor.securityContext),
        profiles: profiles.length > 0 ? profiles : ["Sem perfil persistido"],
      },
    };
  }

  private permissionLevelLabel(
    context: AuthTokenPayload["securityContext"],
  ): string {
    switch (context) {
      case "critical_verified":
        return "Critico verificado";
      case "sensitive_verified":
        return "Sensiveis verificados";
      case "privileged":
        return "Privilegiado";
      case "authenticated":
      default:
        return "Autenticado";
    }
  }

  private deliveryNotes(delivery?: string): string[] {
    const normalized = this.normalized(delivery);
    if (normalized === "pdf") {
      // TODO(reports): ligar ao renderizador PDF quando o projeto definir template, storage e assinatura visual.
      return [
        "PDF ainda nao possui renderizador no backend; os dados ja retornam estruturados para essa etapa.",
      ];
    }
    if (normalized === "email") {
      // TODO(reports): ligar ao modulo de jobs/notificacoes quando destinatarios e politica de envio existirem.
      return [
        "Email ainda depende do modulo de jobs e destinatarios; os dados ja retornam estruturados.",
      ];
    }
    return [];
  }

  private dateRangeFromFilters(
    filters: Record<string, unknown>,
    labels: string[],
  ): DateRange | undefined {
    for (const label of labels) {
      const start = this.parseDate(filters[`${label}::inicio`]);
      const end = this.parseDate(filters[`${label}::fim`], true);
      if (start || end) {
        return { start, end };
      }
    }
    return undefined;
  }

  private defaultFutureRange(days: number): DateRange {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private dateFilter(range?: DateRange) {
    if (!range?.start && !range?.end) {
      return undefined;
    }

    return {
      ...(range.start ? { gte: range.start } : {}),
      ...(range.end ? { lte: range.end } : {}),
    };
  }

  private parseDate(value: unknown, endOfDay = false): Date | undefined {
    const raw = this.text(value);
    if (raw.isEmpty) {
      return undefined;
    }

    const brDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.value);
    const parsed = brDate
      ? new Date(Number(brDate[3]), Number(brDate[2]) - 1, Number(brDate[1]))
      : new Date(raw.value);

    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }

    if (endOfDay) {
      parsed.setHours(23, 59, 59, 999);
    } else {
      parsed.setHours(0, 0, 0, 0);
    }
    return parsed;
  }

  private employmentStatusFilter(
    filters: Record<string, unknown>,
  ): EmploymentLinkStatus | undefined {
    const option = this.normalized(this.filterValue(filters, "Status"));
    if (!option || option === "todos") {
      return undefined;
    }

    if (option.includes("ativo")) {
      return EmploymentLinkStatus.ACTIVE;
    }
    if (option.includes("pendente") || option.includes("admissional")) {
      return EmploymentLinkStatus.PENDING;
    }
    if (option.includes("afastado") || option.includes("suspenso")) {
      return EmploymentLinkStatus.SUSPENDED;
    }
    if (option.includes("desligado") || option.includes("historico")) {
      return EmploymentLinkStatus.DISMISSED;
    }
    return undefined;
  }

  private calendarKindFilter(
    filters: Record<string, unknown>,
  ): CalendarEntryKind | undefined {
    const option = this.normalized(
      this.filterValue(filters, "Tipo de agenda") ??
        this.filterValue(filters, "Tipo"),
    );
    if (!option || this.isNeutralOption(option)) {
      return undefined;
    }
    if (option.includes("lembrete")) {
      return CalendarEntryKind.REMINDER;
    }
    if (option.includes("compromisso") || option.includes("agenda")) {
      return CalendarEntryKind.APPOINTMENT;
    }
    return undefined;
  }

  private calendarStatusFilter(
    filters: Record<string, unknown>,
  ): CalendarEntryStatus | undefined {
    const option = this.normalized(
      this.filterValue(filters, "Status da agenda") ??
        this.filterValue(filters, "Status"),
    );
    if (!option || this.isNeutralOption(option)) {
      return undefined;
    }
    if (option.includes("agend") || option.includes("pendente")) {
      return CalendarEntryStatus.SCHEDULED;
    }
    if (option.includes("conclu") || option.includes("feito")) {
      return CalendarEntryStatus.COMPLETED;
    }
    if (option.includes("cancel")) {
      return CalendarEntryStatus.CANCELED;
    }
    if (
      option.includes("perdid") ||
      option.includes("vencid") ||
      option.includes("atras")
    ) {
      return CalendarEntryStatus.MISSED;
    }
    return undefined;
  }

  private filterAuditRows(templateId: string, rows: ReportRow[]) {
    return rows.filter((row) => {
      const action = this.normalized(row.acao);
      const moduleName = this.normalized(row.modulo);
      switch (templateId) {
        case "audit_deletions":
          return (
            action.includes("delete") ||
            action.includes("remove") ||
            action.includes("inativ")
          );
        case "audit_additions":
          return (
            action.includes("create") ||
            action.includes("add") ||
            action.includes("post")
          );
        case "audit_settings":
          return (
            moduleName.includes("config") ||
            moduleName.includes("perfil") ||
            moduleName.includes("param") ||
            action.includes("permission")
          );
        case "audit_changes":
        default:
          return true;
      }
    });
  }

  private expirationSeverity(date: Date | null): string {
    if (!date) {
      return "Baixo";
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil(
      (date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
    );

    if (diffDays <= 15) {
      return "Critico";
    }
    if (diffDays <= 30) {
      return "Alto";
    }
    if (diffDays <= 60) {
      return "Medio";
    }
    return "Baixo";
  }

  private calendarKindLabel(kind: CalendarEntryKind): string {
    return kind === CalendarEntryKind.REMINDER ? "Lembrete" : "Compromisso";
  }

  private calendarStatusLabel(status: CalendarEntryStatus): string {
    switch (status) {
      case CalendarEntryStatus.COMPLETED:
        return "Concluido";
      case CalendarEntryStatus.CANCELED:
        return "Cancelado";
      case CalendarEntryStatus.MISSED:
        return "Perdido";
      case CalendarEntryStatus.SCHEDULED:
      default:
        return "Agendado";
    }
  }

  private calendarPriorityLabel(priority: string): string {
    switch (priority) {
      case "LOW":
        return "Baixa";
      case "HIGH":
        return "Alta";
      case "CRITICAL":
        return "Critica";
      case "NORMAL":
      default:
        return "Normal";
    }
  }

  private nonBusinessDayLabel(
    date: Date,
    holidayRegionCode?: string | null,
  ): string {
    const labels: string[] = [];
    const weekday = date.getDay();
    if (weekday === 0 || weekday === 6) {
      labels.push("Fim de semana");
    }
    if (!this.text(holidayRegionCode).isEmpty) {
      labels.push(`Feriado (${holidayRegionCode})`);
    }
    return labels.length > 0 ? labels.join(" / ") : "Dia util";
  }

  private calendarApplicabilityLabel(
    regionCode?: string | null,
    stateCode?: string | null,
    cityName?: string | null,
  ): string {
    const labels = [cityName, stateCode, regionCode ? `regiao ${regionCode}` : null]
      .map((value) => this.text(value).value)
      .filter((value) => value.length > 0);
    return labels.length > 0 ? labels.join(" / ") : "Geral";
  }

  private calendarChannelsLabel(value: Prisma.JsonValue): string {
    if (!Array.isArray(value)) {
      return "No app";
    }

    const labels = value
      .map((item) => {
        switch (item) {
          case "EMAIL":
            return "Email";
          case "PUSH":
            return "Push";
          case "WEBHOOK":
            return "Webhook";
          case "IN_APP":
            return "No app";
          default:
            return "";
        }
      })
      .filter((item) => item.length > 0);

    return labels.length > 0 ? labels.join(", ") : "No app";
  }

  private calendarNotificationPolicyLabel(
    policy: string,
    offsetBusinessDays: number,
  ): string {
    switch (policy) {
      case "ONE_BUSINESS_DAY_BEFORE":
        return "1 dia util antes";
      case "SAME_DAY_OR_PREVIOUS_BUSINESS_DAY":
        return "No dia ou no dia util anterior";
      case "CUSTOM_BUSINESS_DAYS_BEFORE":
        return `${offsetBusinessDays} dia(s) util(eis) antes`;
      case "ON_DUE_DATE":
      default:
        return "No dia";
    }
  }

  private applyTextFilter<T extends ReportRow>(
    rows: T[],
    filters: Record<string, unknown>,
    label: string,
    keys: string[],
  ): T[] {
    const needle = this.normalized(this.filterValue(filters, label));
    if (!needle || this.isNeutralOption(needle)) {
      return rows;
    }

    return rows.filter((row) =>
      keys.some((key) => this.normalized(row[key]).includes(needle)),
    );
  }

  private applyOptionFilter<T extends ReportRow>(
    rows: T[],
    filters: Record<string, unknown>,
    label: string,
    key: string,
  ): T[] {
    const option = this.normalized(this.filterValue(filters, label));
    if (!option || this.isNeutralOption(option)) {
      return rows;
    }

    return rows.filter((row) => this.normalized(row[key]).includes(option));
  }

  private isNeutralOption(value: string): boolean {
    return value === "todos" || value === "todas" || value === "inclui";
  }

  private filterValue(
    filters: Record<string, unknown>,
    label: string,
  ): string | undefined {
    const direct = filters[`${label}::valor`];
    if (direct !== undefined) {
      return this.text(direct).value;
    }

    const loose = filters[label];
    if (loose !== undefined) {
      return this.text(loose).value;
    }

    return undefined;
  }

  private formatDate(value?: Date | null): string {
    if (!value) {
      return "nao informado";
    }
    return value.toISOString().slice(0, 10);
  }

  private formatDateTime(value: Date): string {
    return value.toISOString().replace("T", " ").slice(0, 16);
  }

  private formatDateTimeNullable(value?: Date | null): string {
    return value ? this.formatDateTime(value) : "nao informado";
  }

  private toCsv(columns: ReportColumn[], rows: ReportRow[]): string {
    if (columns.length === 0) {
      return "";
    }

    const header = columns
      .map((column) => this.csvCell(column.label))
      .join(";");
    const body = rows.map((row) =>
      columns.map((column) => this.csvCell(row[column.key])).join(";"),
    );
    return [header, ...body].join("\n");
  }

  private csvCell(value: unknown): string {
    const text = value === null || value === undefined ? "" : `${value}`;
    if (/[;"\n\r]/.test(text)) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  }

  private normalized(value: unknown): string {
    return this.text(value)
      .value.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  private text(value: unknown): { value: string; isEmpty: boolean } {
    const text = value === null || value === undefined ? "" : `${value}`.trim();
    return {
      value: text,
      isEmpty: text.length === 0,
    };
  }
}
