import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import {
  CalendarEntryKind,
  CalendarEntryStatus,
  CalendarEntryTargetType,
  CalendarNotificationPolicy,
  CalendarNonBusinessDay,
  EmploymentLinkStatus,
  NotificationOutboxChannel,
  Prisma,
  UserSystemStatus
} from '@prisma/client';
import {
  tenantCreateRelation,
  tenantWhere
} from '../../common/tenant/tenant-scope';
import { createPublicId } from '../../common/utils/public-id';
import { PrismaService } from '../../infra/database/prisma.service';
import { AuthTokenPayload } from '../auth/interfaces/auth-token-payload.interface';
import { CalendarApplicabilityQueryDto } from './dto/calendar-applicability-query.dto';
import {
  CalendarNotificationChannel,
  CreateCalendarEntryDto,
  calendarNotificationChannels
} from './dto/create-calendar-entry.dto';
import { CreateCalendarNonBusinessDayDto } from './dto/create-calendar-non-business-day.dto';
import { ListCalendarEntriesQueryDto } from './dto/list-calendar-entries-query.dto';
import { ListCalendarNonBusinessDaysQueryDto } from './dto/list-calendar-non-business-days-query.dto';
import { UpdateCalendarEntryDto } from './dto/update-calendar-entry.dto';

const calendarEntryInclude = {
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
          clientCompany: true
        }
      },
      position: true
    }
  },
  position: true,
  createdByUserSystem: true,
  assignedToUserSystem: true
} satisfies Prisma.CalendarEntryInclude;

type CalendarEntryWithRelations = Prisma.CalendarEntryGetPayload<{
  include: typeof calendarEntryInclude;
}>;

interface CalendarTargetRelations {
  targetType: CalendarEntryTargetType;
  personId?: bigint;
  providerCompanyId?: bigint;
  clientCompanyId?: bigint;
  contractId?: bigint;
  employmentLinkId?: bigint;
  positionId?: bigint;
}

interface CalendarBusinessDaySet {
  exact: Set<string>;
  annual: Set<string>;
}

interface CalendarGeoScope {
  regionCode: string | null;
  stateCode: string | null;
  cityName: string | null;
}

interface CalendarListRange {
  from: Date;
  to: Date;
}

@Injectable()
export class CalendarService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: ListCalendarEntriesQueryDto, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    const and: Prisma.CalendarEntryWhereInput[] = [];

    if (query.personPublicId) {
      and.push({
        OR: [
          { person: { publicId: query.personPublicId } },
          { employmentLink: { person: { publicId: query.personPublicId } } }
        ]
      });
    }

    if (query.contractPublicId) {
      and.push({
        OR: [
          { contract: { publicId: query.contractPublicId } },
          { employmentLink: { contract: { publicId: query.contractPublicId } } }
        ]
      });
    }

    if (query.providerCompanyPublicId) {
      and.push({
        OR: [
          { providerCompany: { publicId: query.providerCompanyPublicId } },
          {
            contract: {
              providerCompany: { publicId: query.providerCompanyPublicId }
            }
          },
          {
            employmentLink: {
              providerCompany: { publicId: query.providerCompanyPublicId }
            }
          }
        ]
      });
    }

    if (query.clientCompanyPublicId) {
      and.push({
        OR: [
          { clientCompany: { publicId: query.clientCompanyPublicId } },
          {
            contract: {
              clientCompany: { publicId: query.clientCompanyPublicId }
            }
          },
          {
            employmentLink: {
              contract: {
                clientCompany: { publicId: query.clientCompanyPublicId }
              }
            }
          }
        ]
      });
    }

    if (query.employmentLinkPublicId) {
      and.push({
        employmentLink: { publicId: query.employmentLinkPublicId }
      });
    }

    if (query.positionPublicId) {
      and.push({
        OR: [
          { position: { publicId: query.positionPublicId } },
          { employmentLink: { position: { publicId: query.positionPublicId } } }
        ]
      });
    }

    if (query.contractTypePublicId) {
      and.push({
        OR: [
          { contract: { contractType: { publicId: query.contractTypePublicId } } },
          {
            employmentLink: {
              contract: {
                contractType: { publicId: query.contractTypePublicId }
              }
            }
          }
        ]
      });
    }

    if (query.kind) {
      and.push({ kind: query.kind });
    }

    if (query.status) {
      and.push({ status: query.status });
    }

    if (query.category) {
      and.push({ category: query.category });
    }

    const recurrenceRule = this.recurrenceRuleValue(query.recurrenceRule);
    if (query.recurrenceRule) {
      and.push(
        recurrenceRule ? { recurrenceRule } : { recurrenceRule: null }
      );
    }

    if (query.holidayRegionCode) {
      and.push({ holidayRegionCode: query.holidayRegionCode });
    }

    if (query.appliesToRegionCode) {
      and.push({ appliesToRegionCode: query.appliesToRegionCode });
    }

    if (query.appliesToStateCode) {
      and.push({ appliesToStateCode: query.appliesToStateCode });
    }

    if (query.appliesToCityName) {
      and.push({
        appliesToCityName: { contains: query.appliesToCityName }
      });
    }

    const occurrenceRange = this.calendarListRange(query);
    const startsAt = this.dateFilter(query.startsAtFrom, query.startsAtTo);
    if (startsAt) {
      if (query.recurrenceRule) {
        and.push(
          recurrenceRule
            ? { startsAt: { lte: occurrenceRange!.to } }
            : { startsAt, recurrenceRule: null }
        );
      } else {
        and.push({
          OR: [
            { startsAt, recurrenceRule: null },
            {
              recurrenceRule: { not: null },
              startsAt: { lte: occurrenceRange!.to }
            }
          ]
        });
      }
    }

    const createdAt = this.dateFilter(query.createdAtFrom, query.createdAtTo);
    if (createdAt) {
      and.push({ createdAt });
    }

    if (!query.includeDismissed) {
      and.push({
        OR: [
          { employmentLinkId: null },
          { employmentLink: { status: { not: EmploymentLinkStatus.DISMISSED } } }
        ]
      });
    }

    const items = await this.prisma.calendarEntry.findMany({
      where: tenantWhere(actor, and.length > 0 ? { AND: and } : {}),
      take: 100,
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      include: calendarEntryInclude
    });

    return {
      items: this.mapEntriesForRange(items, actor, occurrenceRange),
      meta: {
        total: items.length,
        security:
          'Agenda protegida por sessao interna privilegiada; anexos e tags do hub mantem ACL propria.'
      }
    };
  }

  async create(dto: CreateCalendarEntryDto, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    const actorUserId = await this.resolveAuthenticatedUserId(actor.sub);
    const relations = await this.resolveTargetRelations(dto, actor);
    const startsAt = this.parseDateTime(dto.startsAt, dto.notificationTime);
    const endsAt = dto.endsAt
      ? this.parseDateTime(dto.endsAt, dto.notificationTime)
      : null;
    const geoScope = this.normalizeGeoScope({
      regionCode: dto.appliesToRegionCode ?? dto.holidayRegionCode,
      stateCode: dto.appliesToStateCode,
      cityName: dto.appliesToCityName
    });
    const notificationChannels = this.normalizeChannels(
      dto.notificationChannels
    );
    const nonBusinessDays = await this.loadNonBusinessDayKeys(
      actor,
      startsAt,
      dto.holidayRegionCode
    );
    const notificationScheduledAt = this.calculateNotificationScheduledAt({
      startsAt,
      policy: dto.notificationPolicy,
      offsetBusinessDays: dto.notificationOffsetBusinessDays,
      notificationTime: dto.notificationTime,
      holidayRegionCode: dto.holidayRegionCode,
      nonBusinessDays
    });

    const created = await this.prisma.calendarEntry.create({
      data: {
        publicId: createPublicId('agi'),
        tenantRootCompany: tenantCreateRelation(actor),
        kind: dto.kind,
        status: dto.status,
        priority: dto.priority,
        targetType: relations.targetType,
        category: this.nullIfEmpty(dto.category),
        recurrenceRule: this.recurrenceRuleValue(dto.recurrenceRule),
        audienceJson: this.audienceJson(dto),
        title: dto.title,
        description: this.nullIfEmpty(dto.description),
        startsAt,
        endsAt,
        timezone: dto.timezone,
        isAllDay: dto.isAllDay,
        businessDayPolicy: dto.businessDayPolicy,
        holidayRegionCode: this.nullIfEmpty(dto.holidayRegionCode),
        appliesToRegionCode: geoScope.regionCode,
        appliesToStateCode: geoScope.stateCode,
        appliesToCityName: geoScope.cityName,
        notificationPolicy: dto.notificationPolicy,
        notificationOffsetBusinessDays: dto.notificationOffsetBusinessDays,
        notificationTime: dto.notificationTime,
        notificationScheduledAt,
        notificationChannelsJson:
          notificationChannels as Prisma.InputJsonValue,
        person: relations.personId
          ? { connect: { id: relations.personId } }
          : undefined,
        providerCompany: relations.providerCompanyId
          ? { connect: { id: relations.providerCompanyId } }
          : undefined,
        clientCompany: relations.clientCompanyId
          ? { connect: { id: relations.clientCompanyId } }
          : undefined,
        contract: relations.contractId
          ? { connect: { id: relations.contractId } }
          : undefined,
        employmentLink: relations.employmentLinkId
          ? { connect: { id: relations.employmentLinkId } }
          : undefined,
        position: relations.positionId
          ? { connect: { id: relations.positionId } }
          : undefined,
        createdByUserSystem: { connect: { id: actorUserId } },
        assignedToUserSystem: { connect: { id: actorUserId } }
      },
      include: calendarEntryInclude
    });

    await this.writeAudit(
      actorUserId,
      'create',
      created.publicId,
      `Criou item de agenda ${created.title}.`
    );

    await this.queueAudienceNotifications(created, dto, notificationChannels);

    return this.mapEntry(created, actor);
  }

  async update(
    publicId: string,
    dto: UpdateCalendarEntryDto,
    actor: AuthTokenPayload
  ) {
    this.prisma.assertConfigured();

    const actorUserId = await this.resolveAuthenticatedUserId(actor.sub);
    const current = await this.ensureEntry(publicId, actor);
    if (!this.canManage(current, actor)) {
      throw new ForbiddenException('Voce nao pode alterar este item de agenda.');
    }

    const hasRelationUpdate = this.hasRelationUpdate(dto);
    const relations = hasRelationUpdate
      ? await this.resolveTargetRelations(dto, actor)
      : undefined;
    const startsAt = dto.startsAt
      ? this.parseDateTime(
          dto.startsAt,
          dto.notificationTime ?? current.notificationTime
        )
      : current.startsAt;
    const endsAt =
      dto.endsAt === undefined
        ? current.endsAt
        : dto.endsAt
          ? this.parseDateTime(
              dto.endsAt,
              dto.notificationTime ?? current.notificationTime
            )
          : null;
    const notificationPolicy =
      dto.notificationPolicy ?? current.notificationPolicy;
    const notificationOffsetBusinessDays =
      dto.notificationOffsetBusinessDays ??
      current.notificationOffsetBusinessDays;
    const notificationTime = dto.notificationTime ?? current.notificationTime;
    const holidayRegionCode =
      dto.holidayRegionCode === undefined
        ? current.holidayRegionCode
        : this.nullIfEmpty(dto.holidayRegionCode);
    const geoScope = this.normalizeGeoScope({
      regionCode:
        dto.appliesToRegionCode === undefined
          ? current.appliesToRegionCode
          : dto.appliesToRegionCode,
      stateCode:
        dto.appliesToStateCode === undefined
          ? current.appliesToStateCode
          : dto.appliesToStateCode,
      cityName:
        dto.appliesToCityName === undefined
          ? current.appliesToCityName
          : dto.appliesToCityName
    });
    const nonBusinessDays = await this.loadNonBusinessDayKeys(
      actor,
      startsAt,
      holidayRegionCode
    );
    const notificationScheduledAt = this.calculateNotificationScheduledAt({
      startsAt,
      policy: notificationPolicy,
      offsetBusinessDays: notificationOffsetBusinessDays,
      notificationTime,
      holidayRegionCode,
      nonBusinessDays
    });
    const shouldUpdateAudience =
      dto.audienceProfileCodes !== undefined ||
      dto.audienceContractTypePublicIds !== undefined;

    const updated = await this.prisma.calendarEntry.update({
      where: { id: current.id },
      data: {
        ...(dto.kind ? { kind: dto.kind } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? { description: this.nullIfEmpty(dto.description) }
          : {}),
        ...(dto.category !== undefined
          ? { category: this.nullIfEmpty(dto.category) }
          : {}),
        ...(dto.recurrenceRule !== undefined
          ? { recurrenceRule: this.recurrenceRuleValue(dto.recurrenceRule) }
          : {}),
        ...(shouldUpdateAudience ? { audienceJson: this.audienceJson(dto) } : {}),
        startsAt,
        endsAt,
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.isAllDay !== undefined ? { isAllDay: dto.isAllDay } : {}),
        ...(dto.businessDayPolicy
          ? { businessDayPolicy: dto.businessDayPolicy }
          : {}),
        holidayRegionCode,
        appliesToRegionCode: geoScope.regionCode,
        appliesToStateCode: geoScope.stateCode,
        appliesToCityName: geoScope.cityName,
        notificationPolicy,
        notificationOffsetBusinessDays,
        notificationTime,
        notificationScheduledAt,
        ...(dto.notificationChannels
          ? {
              notificationChannelsJson: this.normalizeChannels(
                dto.notificationChannels
              ) as Prisma.InputJsonValue
            }
          : {}),
        ...(relations
          ? {
              targetType: relations.targetType,
              personId: relations.personId ?? null,
              providerCompanyId: relations.providerCompanyId ?? null,
              clientCompanyId: relations.clientCompanyId ?? null,
              contractId: relations.contractId ?? null,
              employmentLinkId: relations.employmentLinkId ?? null,
              positionId: relations.positionId ?? null
            }
          : {})
      },
      include: calendarEntryInclude
    });

    await this.writeAudit(
      actorUserId,
      'update',
      updated.publicId,
      `Atualizou item de agenda ${updated.title}.`
    );

    return this.mapEntry(updated, actor);
  }

  async cancel(publicId: string, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    const actorUserId = await this.resolveAuthenticatedUserId(actor.sub);
    const current = await this.ensureEntry(publicId, actor);
    if (!this.canManage(current, actor)) {
      throw new ForbiddenException('Voce nao pode cancelar este item de agenda.');
    }

    const canceled = await this.prisma.calendarEntry.update({
      where: { id: current.id },
      data: {
        status: CalendarEntryStatus.CANCELED,
        canceledAt: new Date()
      },
      include: calendarEntryInclude
    });

    await this.writeAudit(
      actorUserId,
      'cancel',
      canceled.publicId,
      `Cancelou item de agenda ${canceled.title}.`
    );

    return this.mapEntry(canceled, actor);
  }

  async listNonBusinessDays(
    query: ListCalendarNonBusinessDaysQueryDto,
    actor: AuthTokenPayload
  ) {
    this.prisma.assertConfigured();

    const and: Prisma.CalendarNonBusinessDayWhereInput[] = [];
    if (!query.includeInactive) {
      and.push({ active: true });
    }
    if (query.regionCode) {
      const candidates = this.regionCandidates(query.regionCode);
      and.push({
        OR: [
          { regionCode: null },
          { regionCode: { in: candidates } },
          ...(this.stateFromRegionCode(query.regionCode)
            ? [{ stateCode: this.stateFromRegionCode(query.regionCode)! }]
            : [])
        ]
      });
    }
    if (query.stateCode) {
      and.push({
        OR: [{ stateCode: null }, { stateCode: query.stateCode }]
      });
    }

    const date = this.dateFilter(query.from, query.to);
    if (date) {
      and.push({
        OR: [{ date }, { isRecurringYearly: true }]
      });
    }

    const items = await this.prisma.calendarNonBusinessDay.findMany({
      where: tenantWhere(actor, and.length > 0 ? { AND: and } : {}),
      orderBy: [{ date: 'asc' }, { name: 'asc' }],
      take: 200
    });

    return {
      items: items.map((item) => this.mapNonBusinessDay(item)),
      meta: {
        total: items.length,
        note: 'Dias nao uteis entram no calculo de notificacoes em dias uteis.'
      }
    };
  }

  async createNonBusinessDay(
    dto: CreateCalendarNonBusinessDayDto,
    actor: AuthTokenPayload
  ) {
    this.prisma.assertConfigured();

    const actorUserId = await this.resolveAuthenticatedUserId(actor.sub);
    const date = this.parseDateOnlyBoundary(dto.date, false);
    const created = await this.prisma.calendarNonBusinessDay.create({
      data: {
        publicId: createPublicId('dnu'),
        tenantRootCompany: tenantCreateRelation(actor),
        date,
        name: dto.name,
        scope: dto.scope,
        regionCode: this.nullIfEmpty(dto.regionCode),
        stateCode: this.nullIfEmpty(dto.stateCode),
        cityName: this.nullIfEmpty(dto.cityName),
        isRecurringYearly: dto.isRecurringYearly,
        notes: this.nullIfEmpty(dto.notes),
        createdByUserSystem: { connect: { id: actorUserId } }
      }
    });

    await this.writeAudit(
      actorUserId,
      'create_non_business_day',
      created.publicId,
      `Criou dia nao util ${created.name}.`
    );

    return this.mapNonBusinessDay(created);
  }

  async applicability(
    query: CalendarApplicabilityQueryDto,
    actor: AuthTokenPayload
  ) {
    this.prisma.assertConfigured();

    const scope = this.normalizeGeoScope({
      regionCode: query.regionCode,
      stateCode: query.stateCode,
      cityName: query.cityName
    });

    if (!scope.regionCode && !scope.stateCode && !scope.cityName) {
      throw new BadRequestException(
        'Informe estado, cidade ou codigo de regiao para avaliar aplicabilidade.'
      );
    }

    const [people, clientCompanies, providerCompanies] = await Promise.all([
      this.prisma.person.findMany({
        where: tenantWhere(actor, {}),
        take: 800,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: {
          publicId: true,
          name: true,
          cpf: true,
          addressJson: true
        }
      }),
      this.prisma.clientCompany.findMany({
        where: tenantWhere(actor, {}),
        take: 500,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: {
          publicId: true,
          name: true,
          document: true,
          addressJson: true
        }
      }),
      this.prisma.providerCompany.findMany({
        where: tenantWhere(actor, {}),
        take: 500,
        orderBy: [{ tradeName: 'asc' }, { legalName: 'asc' }, { id: 'asc' }],
        select: {
          publicId: true,
          legalName: true,
          tradeName: true,
          document: true,
          addressJson: true
        }
      })
    ]);

    const matchingPeople = people
      .filter((item) => this.addressMatchesScope(item.addressJson, scope))
      .map((item) => ({
        publicId: item.publicId,
        name: item.name,
        document: item.cpf,
        address: this.addressLabel(item.addressJson)
      }));
    const matchingClients = clientCompanies
      .filter((item) => this.addressMatchesScope(item.addressJson, scope))
      .map((item) => ({
        publicId: item.publicId,
        name: item.name,
        document: item.document,
        address: this.addressLabel(item.addressJson)
      }));
    const matchingProviders = providerCompanies
      .filter((item) => this.addressMatchesScope(item.addressJson, scope))
      .map((item) => ({
        publicId: item.publicId,
        name: item.tradeName ?? item.legalName,
        document: item.document,
        address: this.addressLabel(item.addressJson)
      }));

    return {
      scope: {
        regionCode: scope.regionCode,
        stateCode: scope.stateCode,
        cityName: scope.cityName,
        label: this.geoScopeLabel(scope)
      },
      people: matchingPeople,
      clientCompanies: matchingClients,
      providerCompanies: matchingProviders,
      meta: {
        people: matchingPeople.length,
        clientCompanies: matchingClients.length,
        providerCompanies: matchingProviders.length
      }
    };
  }

  async deactivateNonBusinessDay(publicId: string, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    const actorUserId = await this.resolveAuthenticatedUserId(actor.sub);
    const current = await this.prisma.calendarNonBusinessDay.findFirst({
      where: tenantWhere(actor, { publicId }),
      select: { id: true }
    });

    if (!current) {
      throw new NotFoundException('Dia nao util nao encontrado.');
    }

    const updated = await this.prisma.calendarNonBusinessDay.update({
      where: { id: current.id },
      data: { active: false }
    });

    await this.writeAudit(
      actorUserId,
      'deactivate_non_business_day',
      updated.publicId,
      `Desativou dia nao util ${updated.name}.`
    );

    return this.mapNonBusinessDay(updated);
  }

  private async ensureEntry(
    publicId: string,
    actor: AuthTokenPayload
  ): Promise<CalendarEntryWithRelations> {
    const item = await this.prisma.calendarEntry.findFirst({
      where: tenantWhere(actor, { publicId }),
      include: calendarEntryInclude
    });

    if (!item) {
      throw new NotFoundException('Item de agenda nao encontrado.');
    }

    return item;
  }

  private async resolveTargetRelations(
    dto: Pick<
      CreateCalendarEntryDto,
      | 'personPublicId'
      | 'providerCompanyPublicId'
      | 'clientCompanyPublicId'
      | 'contractPublicId'
      | 'employmentLinkPublicId'
      | 'positionPublicId'
    >,
    actor: AuthTokenPayload
  ): Promise<CalendarTargetRelations> {
    const [
      person,
      providerCompany,
      clientCompany,
      contract,
      employmentLink,
      position
    ] = await Promise.all([
      dto.personPublicId
        ? this.prisma.person.findFirst({
            where: tenantWhere(actor, { publicId: dto.personPublicId }),
            select: { id: true }
          })
        : null,
      dto.providerCompanyPublicId
        ? this.prisma.providerCompany.findFirst({
            where: tenantWhere(actor, {
              publicId: dto.providerCompanyPublicId
            }),
            select: { id: true }
          })
        : null,
      dto.clientCompanyPublicId
        ? this.prisma.clientCompany.findFirst({
            where: tenantWhere(actor, { publicId: dto.clientCompanyPublicId }),
            select: { id: true }
          })
        : null,
      dto.contractPublicId
        ? this.prisma.contract.findFirst({
            where: tenantWhere(actor, { publicId: dto.contractPublicId }),
            select: { id: true }
          })
        : null,
      dto.employmentLinkPublicId
        ? this.prisma.employmentLink.findFirst({
            where: tenantWhere(actor, { publicId: dto.employmentLinkPublicId }),
            select: { id: true }
          })
        : null,
      dto.positionPublicId
        ? this.prisma.position.findFirst({
            where: tenantWhere(actor, { publicId: dto.positionPublicId }),
            select: { id: true }
          })
        : null
    ]);

    this.assertFound(dto.personPublicId, person, 'Pessoa');
    this.assertFound(
      dto.providerCompanyPublicId,
      providerCompany,
      'Empresa prestadora'
    );
    this.assertFound(dto.clientCompanyPublicId, clientCompany, 'Cliente');
    this.assertFound(dto.contractPublicId, contract, 'Contrato');
    this.assertFound(dto.employmentLinkPublicId, employmentLink, 'Vinculo');
    this.assertFound(dto.positionPublicId, position, 'Posto');

    if (
      !person &&
      !providerCompany &&
      !clientCompany &&
      !contract &&
      !employmentLink &&
      !position
    ) {
      throw new BadRequestException(
        'Informe ao menos uma pessoa, empresa, contrato, vinculo ou posto para o item de agenda.'
      );
    }

    return {
      targetType: this.resolveTargetType({
        personId: person?.id,
        providerCompanyId: providerCompany?.id,
        clientCompanyId: clientCompany?.id,
        contractId: contract?.id,
        employmentLinkId: employmentLink?.id,
        positionId: position?.id
      }),
      personId: person?.id,
      providerCompanyId: providerCompany?.id,
      clientCompanyId: clientCompany?.id,
      contractId: contract?.id,
      employmentLinkId: employmentLink?.id,
      positionId: position?.id
    };
  }

  private assertFound(
    publicId: string | undefined,
    item: { id: bigint } | null,
    label: string
  ) {
    if (publicId && !item) {
      throw new NotFoundException(`${label} informado(a) nao encontrado(a).`);
    }
  }

  private resolveTargetType(
    relations: Omit<CalendarTargetRelations, 'targetType'>
  ): CalendarEntryTargetType {
    if (relations.personId) {
      return CalendarEntryTargetType.PERSON;
    }
    if (relations.employmentLinkId) {
      return CalendarEntryTargetType.EMPLOYMENT_LINK;
    }
    if (relations.contractId) {
      return CalendarEntryTargetType.CONTRACT;
    }
    if (relations.positionId) {
      return CalendarEntryTargetType.POSITION;
    }
    if (relations.providerCompanyId) {
      return CalendarEntryTargetType.PROVIDER_COMPANY;
    }
    if (relations.clientCompanyId) {
      return CalendarEntryTargetType.CLIENT_COMPANY;
    }
    return CalendarEntryTargetType.GENERAL;
  }

  private hasRelationUpdate(dto: UpdateCalendarEntryDto): boolean {
    return [
      dto.personPublicId,
      dto.providerCompanyPublicId,
      dto.clientCompanyPublicId,
      dto.contractPublicId,
      dto.employmentLinkPublicId,
      dto.positionPublicId
    ].some((value) => value !== undefined);
  }

  private calculateNotificationScheduledAt(input: {
    startsAt: Date;
    policy: CalendarNotificationPolicy;
    offsetBusinessDays: number;
    notificationTime: string;
    holidayRegionCode?: string | null;
    nonBusinessDays: CalendarBusinessDaySet;
  }): Date {
    const dueDate = this.withTime(input.startsAt, input.notificationTime);

    switch (input.policy) {
      case CalendarNotificationPolicy.ONE_BUSINESS_DAY_BEFORE:
        return this.subtractBusinessDays(
          dueDate,
          1,
          input.holidayRegionCode,
          input.nonBusinessDays
        );
      case CalendarNotificationPolicy.SAME_DAY_OR_PREVIOUS_BUSINESS_DAY:
        return this.isBusinessDay(
          dueDate,
          input.holidayRegionCode,
          input.nonBusinessDays
        )
          ? dueDate
          : this.previousBusinessDay(
              dueDate,
              input.holidayRegionCode,
              input.nonBusinessDays
            );
      case CalendarNotificationPolicy.CUSTOM_BUSINESS_DAYS_BEFORE:
        return this.subtractBusinessDays(
          dueDate,
          input.offsetBusinessDays,
          input.holidayRegionCode,
          input.nonBusinessDays
        );
      case CalendarNotificationPolicy.ON_DUE_DATE:
      default:
        return dueDate;
    }
  }

  private subtractBusinessDays(
    date: Date,
    days: number,
    holidayRegionCode: string | null | undefined,
    nonBusinessDays: CalendarBusinessDaySet
  ): Date {
    let cursor = new Date(date);
    let remaining = days;

    while (remaining > 0) {
      cursor = this.addDays(cursor, -1);
      if (this.isBusinessDay(cursor, holidayRegionCode, nonBusinessDays)) {
        remaining -= 1;
      }
    }

    return cursor;
  }

  private previousBusinessDay(
    date: Date,
    holidayRegionCode: string | null | undefined,
    nonBusinessDays: CalendarBusinessDaySet
  ): Date {
    let cursor = new Date(date);
    for (let index = 0; index < 370; index += 1) {
      if (this.isBusinessDay(cursor, holidayRegionCode, nonBusinessDays)) {
        return cursor;
      }
      cursor = this.addDays(cursor, -1);
    }
    return cursor;
  }

  private isBusinessDay(
    date: Date,
    holidayRegionCode: string | null | undefined,
    nonBusinessDays: CalendarBusinessDaySet
  ): boolean {
    const weekday = date.getDay();
    if (weekday === 0 || weekday === 6) {
      return false;
    }
    if (this.isCustomNonBusinessDay(date, nonBusinessDays)) {
      return false;
    }
    return !this.isBrazilianFixedHoliday(date, holidayRegionCode);
  }

  private isBrazilianFixedHoliday(
    date: Date,
    holidayRegionCode?: string | null
  ): boolean {
    const key = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`;
    const national = new Set([
      '01-01',
      '04-21',
      '05-01',
      '09-07',
      '10-12',
      '11-02',
      '11-15',
      '11-20',
      '12-25'
    ]);

    if (national.has(key)) {
      return true;
    }

    // Calendarios regionais/moveis entram aqui sem alterar o contrato publico.
    return false;
  }

  private isCustomNonBusinessDay(
    date: Date,
    nonBusinessDays: CalendarBusinessDaySet
  ): boolean {
    return (
      nonBusinessDays.exact.has(this.dateKey(date)) ||
      nonBusinessDays.annual.has(this.monthDayKey(date))
    );
  }

  private async loadNonBusinessDayKeys(
    actor: AuthTokenPayload,
    referenceDate: Date,
    regionCode?: string | null
  ): Promise<CalendarBusinessDaySet> {
    const normalizedRegionCode = this.nullIfEmpty(regionCode);
    const from = this.addDays(referenceDate, -370);
    const to = this.addDays(referenceDate, 1);
    const and: Prisma.CalendarNonBusinessDayWhereInput[] = [
      { active: true },
      {
        OR: [
          { date: { gte: from, lte: to } },
          { isRecurringYearly: true }
        ]
      }
    ];

    if (normalizedRegionCode) {
      const candidates = this.regionCandidates(normalizedRegionCode);
      const stateCode = this.stateFromRegionCode(normalizedRegionCode);
      and.push({
        OR: [
          { regionCode: null },
          { regionCode: { in: candidates } },
          ...(stateCode ? [{ stateCode }] : [])
        ]
      });
    } else {
      and.push({ regionCode: null });
    }

    const items = await this.prisma.calendarNonBusinessDay.findMany({
      where: tenantWhere(actor, { AND: and }),
      select: {
        date: true,
        isRecurringYearly: true
      }
    });

    return {
      exact: new Set(items.map((item) => this.dateKey(item.date))),
      annual: new Set(
        items
          .filter((item) => item.isRecurringYearly)
          .map((item) => this.monthDayKey(item.date))
      )
    };
  }

  private normalizeGeoScope(input: {
    regionCode?: string | null;
    stateCode?: string | null;
    cityName?: string | null;
  }): CalendarGeoScope {
    const regionCode = this.nullIfEmpty(input.regionCode)?.toUpperCase() ?? null;
    const stateCode =
      this.nullIfEmpty(input.stateCode)?.toUpperCase() ??
      this.stateFromRegionCode(regionCode);
    const cityName =
      this.nullIfEmpty(input.cityName) ?? this.cityFromRegionCode(regionCode);

    return {
      regionCode,
      stateCode,
      cityName
    };
  }

  private regionCandidates(regionCode: string): string[] {
    const normalized = regionCode.trim().toUpperCase();
    const parts = normalized.split('-').filter(Boolean);
    if (parts.length >= 3) {
      return [normalized, parts.slice(0, 2).join('-')];
    }
    return [normalized];
  }

  private stateFromRegionCode(regionCode?: string | null): string | null {
    const parts = regionCode?.split('-').filter(Boolean) ?? [];
    return parts.length >= 2 && parts[1].length === 2
      ? parts[1].toUpperCase()
      : null;
  }

  private cityFromRegionCode(regionCode?: string | null): string | null {
    const parts = regionCode?.split('-').filter(Boolean) ?? [];
    if (parts.length < 3) {
      return null;
    }
    return this.titleCase(parts.slice(2).join(' '));
  }

  private addressMatchesScope(
    value: Prisma.JsonValue | null | undefined,
    scope: CalendarGeoScope
  ): boolean {
    const address = this.addressObject(value);
    if (!address) {
      return false;
    }

    const addressRegionCode = this.addressField(address, [
      'regionCode',
      'region',
      'codigoRegiao'
    ])?.toUpperCase();
    const addressStateCode = this.addressField(address, [
      'state',
      'stateCode',
      'uf',
      'estado'
    ])?.toUpperCase();
    const addressCityName = this.addressField(address, [
      'city',
      'cityName',
      'cidade',
      'municipio'
    ]);

    if (scope.regionCode && addressRegionCode) {
      const candidates = this.regionCandidates(addressRegionCode);
      if (
        candidates.includes(scope.regionCode) ||
        this.regionCandidates(scope.regionCode).includes(addressRegionCode)
      ) {
        return true;
      }
    }

    if (scope.stateCode && addressStateCode !== scope.stateCode) {
      return false;
    }

    if (scope.cityName) {
      return (
        !!addressCityName &&
        this.normalizedSearchText(addressCityName) ===
          this.normalizedSearchText(scope.cityName)
      );
    }

    return !!scope.stateCode && addressStateCode === scope.stateCode;
  }

  private addressObject(
    value: Prisma.JsonValue | null | undefined
  ): Record<string, unknown> | null {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private addressField(
    address: Record<string, unknown>,
    keys: string[]
  ): string | null {
    for (const key of keys) {
      const value = address[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
    return null;
  }

  private addressLabel(value: Prisma.JsonValue | null | undefined): string {
    const address = this.addressObject(value);
    if (!address) {
      return '';
    }

    const city = this.addressField(address, [
      'city',
      'cityName',
      'cidade',
      'municipio'
    ]);
    const state = this.addressField(address, [
      'state',
      'stateCode',
      'uf',
      'estado'
    ]);
    const street = this.addressField(address, [
      'street',
      'logradouro',
      'addressLine'
    ]);
    const number = this.addressField(address, ['number', 'numero']);

    return [
      [street, number].filter(Boolean).join(', '),
      [city, state].filter(Boolean).join('/').toUpperCase()
    ]
      .filter((item) => item.length > 0)
      .join(' | ');
  }

  private geoScopeLabel(scope: CalendarGeoScope): string {
    return (
      [
        scope.cityName,
        scope.stateCode,
        scope.regionCode ? `regiao ${scope.regionCode}` : null
      ]
        .filter(Boolean)
        .join(' / ') || 'sem escopo territorial'
    );
  }

  private normalizedSearchText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  private titleCase(value: string): string {
    return value
      .toLowerCase()
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(' ');
  }

  private dateFilter(
    from?: string,
    to?: string
  ): Prisma.DateTimeFilter | undefined {
    if (!from && !to) {
      return undefined;
    }

    return {
      ...(from ? { gte: this.parseDateOnlyBoundary(from, false) } : {}),
      ...(to ? { lte: this.parseDateOnlyBoundary(to, true) } : {})
    };
  }

  private calendarListRange(
    query: Pick<ListCalendarEntriesQueryDto, 'startsAtFrom' | 'startsAtTo'>
  ): CalendarListRange | null {
    if (!query.startsAtFrom && !query.startsAtTo) {
      return null;
    }

    const from = query.startsAtFrom
      ? this.parseDateOnlyBoundary(query.startsAtFrom, false)
      : new Date(0);
    const to = query.startsAtTo
      ? this.parseDateOnlyBoundary(query.startsAtTo, true)
      : this.addDays(from, 366);

    if (to < from) {
      throw new BadRequestException(
        'Periodo de agenda invalido: data final anterior a inicial.'
      );
    }

    return { from, to };
  }

  private parseDateOnlyBoundary(value: string, endOfDay: boolean): Date {
    const parsed = this.parseDateTime(value, endOfDay ? '23:59' : '00:00');
    if (endOfDay) {
      parsed.setSeconds(59, 999);
    } else {
      parsed.setSeconds(0, 0);
    }
    return parsed;
  }

  private parseDateTime(value: string, fallbackTime: string): Date {
    const raw = value.trim();
    const brDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
    if (brDate) {
      const [hour, minute] = this.timeParts(fallbackTime);
      return new Date(
        Number(brDate[3]),
        Number(brDate[2]) - 1,
        Number(brDate[1]),
        hour,
        minute,
        0,
        0
      );
    }

    const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (isoDate) {
      const [hour, minute] = this.timeParts(fallbackTime);
      return new Date(
        Number(isoDate[1]),
        Number(isoDate[2]) - 1,
        Number(isoDate[3]),
        hour,
        minute,
        0,
        0
      );
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Data de agenda invalida.');
    }
    return parsed;
  }

  private withTime(date: Date, time: string): Date {
    const [hour, minute] = this.timeParts(time);
    const result = new Date(date);
    result.setHours(hour, minute, 0, 0);
    return result;
  }

  private timeParts(time: string): [number, number] {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
    if (!match) {
      throw new BadRequestException('Horario de notificacao invalido.');
    }
    return [Number(match[1]), Number(match[2])];
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private dateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private monthDayKey(date: Date): string {
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`;
  }

  private normalizeChannels(
    channels?: CalendarNotificationChannel[]
  ): CalendarNotificationChannel[] {
    const normalized: CalendarNotificationChannel[] = channels?.length
      ? channels
      : ['IN_APP', 'EMAIL'];
    const filtered = normalized.filter((channel): channel is CalendarNotificationChannel =>
      calendarNotificationChannels.includes(channel)
    );
    return filtered.length > 0 ? filtered : ['IN_APP', 'EMAIL'];
  }

  private recurrenceRuleValue(value?: string | null): string | null {
    const normalized = this.nullIfEmpty(value);
    return normalized && normalized !== 'NONE' ? normalized : null;
  }

  private audienceJson(
    dto: Pick<
      CreateCalendarEntryDto,
      'audienceProfileCodes' | 'audienceContractTypePublicIds'
    >
  ): Prisma.InputJsonValue | undefined {
    if (
      dto.audienceProfileCodes === undefined &&
      dto.audienceContractTypePublicIds === undefined
    ) {
      return undefined;
    }

    const profileCodes = dto.audienceProfileCodes ?? [];
    const contractTypePublicIds = dto.audienceContractTypePublicIds ?? [];

    return {
      profileCodes,
      contractTypePublicIds
    };
  }

  private async queueAudienceNotifications(
    item: CalendarEntryWithRelations,
    dto: CreateCalendarEntryDto,
    channels: CalendarNotificationChannel[]
  ) {
    if (item.kind !== CalendarEntryKind.NOTICE || !channels.includes('EMAIL')) {
      return;
    }

    const profileCodes = dto.audienceProfileCodes ?? [];
    if (profileCodes.length === 0) {
      return;
    }

    const users = await this.prisma.userSystem.findMany({
      where: {
        ...(item.tenantRootCompanyId
          ? { tenantRootCompanyId: item.tenantRootCompanyId }
          : {}),
        status: UserSystemStatus.ACTIVE,
        email: { not: '' },
        accessProfiles: {
          some: {
            accessProfile: {
              code: { in: profileCodes }
            }
          }
        }
      },
      select: {
        id: true,
        email: true,
        name: true
      }
    });

    if (users.length === 0) {
      return;
    }

    const message = [
      dto.description?.trim() || item.title,
      '',
      `Recado enviado pelo PariFlow Partners para os perfis: ${profileCodes.join(
        ', '
      )}.`,
      `Agenda: ${item.publicId}.`
    ].join('\n');

    await this.prisma.notificationOutbox.createMany({
      data: users.map((user) => ({
        publicId: createPublicId('not'),
        tenantRootCompanyId: item.tenantRootCompanyId,
        channel: NotificationOutboxChannel.EMAIL,
        target: user.email,
        subject: item.title,
        message,
        metadataJson: {
          source: 'shared_calendar_notice',
          calendarEntryPublicId: item.publicId,
          userSystemId: String(user.id),
          profileCodes
        } as Prisma.InputJsonValue
      }))
    });
  }

  private async resolveAuthenticatedUserId(userPublicId: string): Promise<bigint> {
    const user = await this.prisma.userSystem.findUnique({
      where: { publicId: userPublicId },
      select: { id: true }
    });

    if (!user) {
      throw new UnauthorizedException(
        'Usuario autenticado nao foi encontrado para registrar a agenda.'
      );
    }

    return user.id;
  }

  private async writeAudit(
    userSystemId: bigint,
    action: string,
    entityPublicId: string,
    description: string
  ) {
    await this.prisma.auditLog.create({
      data: {
        publicId: createPublicId('aud'),
        userSystemId,
        entityName: 'agenda_item',
        entityPublicId,
        action,
        description
      }
    });
  }

  private canManage(
    item: CalendarEntryWithRelations,
    actor: AuthTokenPayload
  ): boolean {
    if (item.createdByUserSystem?.publicId === actor.sub) {
      return true;
    }
    if (item.assignedToUserSystem?.publicId === actor.sub) {
      return true;
    }
    return actor.securityContext !== 'authenticated';
  }

  private mapEntriesForRange(
    items: CalendarEntryWithRelations[],
    actor: AuthTokenPayload,
    range: CalendarListRange | null
  ) {
    if (!range) {
      return items.map((item) => this.mapEntry(item, actor));
    }

    const mappedItems = items.flatMap((item) => {
      const occurrences = this.recurrenceOccurrences(item, range);
      return occurrences.map((occurrenceStartsAt) => {
        const mapped = this.mapEntry(item, actor);
        return {
          ...mapped,
          occurrenceStartsAt,
          occurrenceStartsAtLabel: this.formatDateTime(occurrenceStartsAt),
          seriesStartsAt: item.startsAt,
          seriesStartsAtLabel: this.formatDateTime(item.startsAt),
          isRecurringOccurrence:
            Boolean(item.recurrenceRule) &&
            occurrenceStartsAt.getTime() !== item.startsAt.getTime()
        };
      });
    });

    return mappedItems
      .sort(
        (left, right) =>
          left.occurrenceStartsAt.getTime() -
          right.occurrenceStartsAt.getTime()
      )
      .slice(0, 100);
  }

  private recurrenceOccurrences(
    item: CalendarEntryWithRelations,
    range: CalendarListRange
  ): Date[] {
    const rule = this.recurrenceRuleValue(item.recurrenceRule);
    if (!rule) {
      return this.isWithinRange(item.startsAt, range) ? [item.startsAt] : [];
    }

    switch (rule) {
      case 'DAILY':
        return this.dailyOccurrences(item.startsAt, range, false);
      case 'WEEKDAYS':
        return this.dailyOccurrences(item.startsAt, range, true);
      case 'WEEKLY':
        return this.weeklyOccurrences(item.startsAt, range);
      case 'MONTHLY':
        return this.monthlyOccurrences(item.startsAt, range, false);
      case 'MONTHLY_NTH_WEEKDAY':
        return this.monthlyOccurrences(item.startsAt, range, true);
      case 'YEARLY':
        return this.yearlyOccurrences(item.startsAt, range);
      default:
        return this.isWithinRange(item.startsAt, range) ? [item.startsAt] : [];
    }
  }

  private dailyOccurrences(
    seriesStart: Date,
    range: CalendarListRange,
    weekdaysOnly: boolean
  ): Date[] {
    const occurrences: Date[] = [];
    let cursor = this.dateOnly(
      seriesStart > range.from ? seriesStart : range.from
    );

    while (cursor <= range.to && occurrences.length < 100) {
      const occurrence = this.withSeriesTime(cursor, seriesStart);
      const day = occurrence.getDay();
      if (
        occurrence >= seriesStart &&
        this.isWithinRange(occurrence, range) &&
        (!weekdaysOnly || (day >= 1 && day <= 5))
      ) {
        occurrences.push(occurrence);
      }
      cursor = this.addDays(cursor, 1);
    }

    return occurrences;
  }

  private weeklyOccurrences(
    seriesStart: Date,
    range: CalendarListRange
  ): Date[] {
    const occurrences: Date[] = [];
    const targetWeekday = seriesStart.getDay();
    let cursor = this.dateOnly(
      seriesStart > range.from ? seriesStart : range.from
    );

    while (cursor.getDay() !== targetWeekday) {
      cursor = this.addDays(cursor, 1);
    }

    while (cursor <= range.to && occurrences.length < 100) {
      const occurrence = this.withSeriesTime(cursor, seriesStart);
      if (occurrence >= seriesStart && this.isWithinRange(occurrence, range)) {
        occurrences.push(occurrence);
      }
      cursor = this.addDays(cursor, 7);
    }

    return occurrences;
  }

  private monthlyOccurrences(
    seriesStart: Date,
    range: CalendarListRange,
    nthWeekday: boolean
  ): Date[] {
    const occurrences: Date[] = [];
    let year = range.from.getFullYear();
    let month = range.from.getMonth();
    const endYear = range.to.getFullYear();
    const endMonth = range.to.getMonth();

    while (
      (year < endYear || (year === endYear && month <= endMonth)) &&
      occurrences.length < 100
    ) {
      const candidate = nthWeekday
        ? this.nthWeekdayOfMonth(
            year,
            month,
            Math.ceil(seriesStart.getDate() / 7),
            seriesStart.getDay(),
            seriesStart
          )
        : this.dayOfMonth(
            year,
            month,
            seriesStart.getDate(),
            seriesStart
          );

      if (
        candidate &&
        candidate >= seriesStart &&
        this.isWithinRange(candidate, range)
      ) {
        occurrences.push(candidate);
      }

      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }

    return occurrences;
  }

  private yearlyOccurrences(
    seriesStart: Date,
    range: CalendarListRange
  ): Date[] {
    const occurrences: Date[] = [];
    for (
      let year = range.from.getFullYear();
      year <= range.to.getFullYear() && occurrences.length < 100;
      year += 1
    ) {
      const candidate = this.dayOfMonth(
        year,
        seriesStart.getMonth(),
        seriesStart.getDate(),
        seriesStart
      );
      if (
        candidate &&
        candidate >= seriesStart &&
        this.isWithinRange(candidate, range)
      ) {
        occurrences.push(candidate);
      }
    }
    return occurrences;
  }

  private dayOfMonth(
    year: number,
    month: number,
    day: number,
    seriesStart: Date
  ): Date | null {
    if (day > this.daysInMonth(year, month)) {
      return null;
    }
    return new Date(
      year,
      month,
      day,
      seriesStart.getHours(),
      seriesStart.getMinutes(),
      seriesStart.getSeconds(),
      seriesStart.getMilliseconds()
    );
  }

  private nthWeekdayOfMonth(
    year: number,
    month: number,
    nth: number,
    weekday: number,
    seriesStart: Date
  ): Date | null {
    const first = new Date(year, month, 1);
    const offset = (weekday - first.getDay() + 7) % 7;
    const day = 1 + offset + (nth - 1) * 7;
    return this.dayOfMonth(year, month, day, seriesStart);
  }

  private daysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  private withSeriesTime(date: Date, seriesStart: Date): Date {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      seriesStart.getHours(),
      seriesStart.getMinutes(),
      seriesStart.getSeconds(),
      seriesStart.getMilliseconds()
    );
  }

  private dateOnly(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private isWithinRange(date: Date, range: CalendarListRange): boolean {
    return date >= range.from && date <= range.to;
  }

  private mapEntry(item: CalendarEntryWithRelations, actor: AuthTokenPayload) {
    const channels = this.channelsFromJson(item.notificationChannelsJson);
    const person =
      item.person ??
      item.employmentLink?.person ??
      null;
    const providerCompany =
      item.providerCompany ??
      item.contract?.providerCompany ??
      item.employmentLink?.providerCompany ??
      null;
    const clientCompany =
      item.clientCompany ??
      item.contract?.clientCompany ??
      item.employmentLink?.contract.clientCompany ??
      null;
    const contract = item.contract ?? item.employmentLink?.contract ?? null;
    const position = item.position ?? item.employmentLink?.position ?? null;

    return {
      publicId: item.publicId,
      kind: item.kind,
      kindLabel: this.kindLabel(item.kind),
      status: item.status,
      statusLabel: this.statusLabel(item.status),
      priority: item.priority,
      priorityLabel: this.priorityLabel(item.priority),
      targetType: item.targetType,
      category: item.category,
      recurrenceRule: item.recurrenceRule,
      recurrenceRuleLabel: this.recurrenceRuleLabel(item.recurrenceRule),
      audience: this.audienceFromJson(item.audienceJson),
      title: item.title,
      description: item.description ?? '',
      startsAt: item.startsAt,
      startsAtLabel: this.formatDateTime(item.startsAt),
      endsAt: item.endsAt,
      endsAtLabel: item.endsAt ? this.formatDateTime(item.endsAt) : '',
      timezone: item.timezone,
      isAllDay: item.isAllDay,
      businessDayPolicy: item.businessDayPolicy,
      holidayRegionCode: item.holidayRegionCode,
      applicability: {
        regionCode: item.appliesToRegionCode,
        stateCode: item.appliesToStateCode,
        cityName: item.appliesToCityName,
        label: this.geoScopeLabel({
          regionCode: item.appliesToRegionCode,
          stateCode: item.appliesToStateCode,
          cityName: item.appliesToCityName
        })
      },
      target: {
        label: this.targetLabel(item),
        person: person
          ? {
              publicId: person.publicId,
              name: person.name
            }
          : null,
        providerCompany: providerCompany
          ? {
              publicId: providerCompany.publicId,
              name: providerCompany.tradeName ?? providerCompany.legalName
            }
          : null,
        clientCompany: clientCompany
          ? {
              publicId: clientCompany.publicId,
              name: clientCompany.name
            }
          : null,
        contract: contract
          ? {
              publicId: contract.publicId
            }
          : null,
        position: position
          ? {
              publicId: position.publicId,
              name: position.name
            }
          : null
      },
      notification: {
        policy: item.notificationPolicy,
        policyLabel: this.notificationPolicyLabel(
          item.notificationPolicy,
          item.notificationOffsetBusinessDays
        ),
        offsetBusinessDays: item.notificationOffsetBusinessDays,
        time: item.notificationTime,
        scheduledAt: item.notificationScheduledAt,
        scheduledAtLabel: item.notificationScheduledAt
          ? this.formatDateTime(item.notificationScheduledAt)
          : '',
        channels,
        channelsLabel: channels.map(this.channelLabel).join(', ')
      },
      createdBy: item.createdByUserSystem
        ? {
            publicId: item.createdByUserSystem.publicId,
            name: item.createdByUserSystem.name
          }
        : null,
      assignedTo: item.assignedToUserSystem
        ? {
            publicId: item.assignedToUserSystem.publicId,
            name: item.assignedToUserSystem.name
          }
        : null,
      canEdit: this.canManage(item, actor),
      canCancel:
        item.status !== CalendarEntryStatus.CANCELED &&
        this.canManage(item, actor)
    };
  }

  private channelsFromJson(value: Prisma.JsonValue): CalendarNotificationChannel[] {
    if (!Array.isArray(value)) {
      return ['IN_APP'];
    }
    const channels = value.filter(
      (item): item is CalendarNotificationChannel =>
        typeof item === 'string' &&
        calendarNotificationChannels.includes(item as CalendarNotificationChannel)
    );
    return channels.length > 0 ? channels : ['IN_APP'];
  }

  private audienceFromJson(value: Prisma.JsonValue) {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      return {
        profileCodes: <string[]>[],
        contractTypePublicIds: <string[]>[]
      };
    }

    const raw = value as Record<string, unknown>;
    return {
      profileCodes: Array.isArray(raw.profileCodes)
        ? raw.profileCodes.filter((item): item is string => typeof item === 'string')
        : <string[]>[],
      contractTypePublicIds: Array.isArray(raw.contractTypePublicIds)
        ? raw.contractTypePublicIds.filter(
            (item): item is string => typeof item === 'string'
          )
        : <string[]>[]
    };
  }

  private mapNonBusinessDay(item: CalendarNonBusinessDay) {
    return {
      publicId: item.publicId,
      date: item.date,
      dateLabel: this.formatDate(item.date),
      name: item.name,
      scope: item.scope,
      regionCode: item.regionCode,
      stateCode: item.stateCode,
      cityName: item.cityName,
      applicability: {
        regionCode: item.regionCode,
        stateCode: item.stateCode,
        cityName: item.cityName,
        label: this.geoScopeLabel({
          regionCode: item.regionCode,
          stateCode: item.stateCode,
          cityName: item.cityName
        })
      },
      isRecurringYearly: item.isRecurringYearly,
      active: item.active,
      notes: item.notes ?? '',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }

  private targetLabel(item: CalendarEntryWithRelations): string {
    if (item.person) {
      return item.person.name;
    }
    if (item.employmentLink) {
      return item.employmentLink.person.name;
    }
    if (item.position) {
      return item.position.name;
    }
    if (item.contract) {
      return `Contrato ${item.contract.publicId}`;
    }
    if (item.providerCompany) {
      return item.providerCompany.tradeName ?? item.providerCompany.legalName;
    }
    if (item.clientCompany) {
      return item.clientCompany.name;
    }
    return 'Agenda geral';
  }

  private recurrenceRuleLabel(rule?: string | null): string {
    switch (this.recurrenceRuleValue(rule)) {
      case 'DAILY':
        return 'Todos os dias';
      case 'WEEKDAYS':
        return 'Dias uteis';
      case 'WEEKLY':
        return 'Semanal';
      case 'MONTHLY':
        return 'Mensal';
      case 'MONTHLY_NTH_WEEKDAY':
        return 'Mensal por dia da semana';
      case 'YEARLY':
        return 'Anual';
      default:
        return 'Nao se repete';
    }
  }

  private kindLabel(kind: CalendarEntryKind): string {
    switch (kind) {
      case CalendarEntryKind.REMINDER:
        return 'Lembrete';
      case CalendarEntryKind.NOTICE:
        return 'Recado';
      case CalendarEntryKind.APPOINTMENT:
      default:
        return 'Compromisso';
    }
  }

  private statusLabel(status: CalendarEntryStatus): string {
    switch (status) {
      case CalendarEntryStatus.COMPLETED:
        return 'Concluido';
      case CalendarEntryStatus.CANCELED:
        return 'Cancelado';
      case CalendarEntryStatus.MISSED:
        return 'Perdido';
      case CalendarEntryStatus.SCHEDULED:
      default:
        return 'Agendado';
    }
  }

  private priorityLabel(priority: string): string {
    switch (priority) {
      case 'LOW':
        return 'Baixa';
      case 'HIGH':
        return 'Alta';
      case 'CRITICAL':
        return 'Critica';
      case 'NORMAL':
      default:
        return 'Normal';
    }
  }

  private notificationPolicyLabel(
    policy: CalendarNotificationPolicy,
    offsetBusinessDays: number
  ): string {
    switch (policy) {
      case CalendarNotificationPolicy.ONE_BUSINESS_DAY_BEFORE:
        return '1 dia util antes';
      case CalendarNotificationPolicy.SAME_DAY_OR_PREVIOUS_BUSINESS_DAY:
        return 'No dia ou no dia util anterior';
      case CalendarNotificationPolicy.CUSTOM_BUSINESS_DAYS_BEFORE:
        return `${offsetBusinessDays} dia(s) util(eis) antes`;
      case CalendarNotificationPolicy.ON_DUE_DATE:
      default:
        return 'No dia';
    }
  }

  private channelLabel(channel: CalendarNotificationChannel): string {
    switch (channel) {
      case 'EMAIL':
        return 'Email';
      case 'PUSH':
        return 'Push';
      case 'WEBHOOK':
        return 'Webhook';
      case 'IN_APP':
      default:
        return 'No app';
    }
  }

  private formatDateTime(value: Date): string {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const hour = String(value.getHours()).padStart(2, '0');
    const minute = String(value.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${value.getFullYear()} ${hour}:${minute}`;
  }

  private formatDate(value: Date): string {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${value.getFullYear()}`;
  }

  private nullIfEmpty(value?: string | null): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
}
