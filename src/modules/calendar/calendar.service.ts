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
  Prisma
} from '@prisma/client';
import { createPublicId } from '../../common/utils/public-id';
import { PrismaService } from '../../infra/database/prisma.service';
import { AuthTokenPayload } from '../auth/interfaces/auth-token-payload.interface';
import {
  CalendarNotificationChannel,
  CreateCalendarEntryDto,
  calendarNotificationChannels
} from './dto/create-calendar-entry.dto';
import { ListCalendarEntriesQueryDto } from './dto/list-calendar-entries-query.dto';
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

    if (query.kind) {
      and.push({ kind: query.kind });
    }

    if (query.status) {
      and.push({ status: query.status });
    }

    const startsAt = this.dateFilter(query.startsAtFrom, query.startsAtTo);
    if (startsAt) {
      and.push({ startsAt });
    }

    const items = await this.prisma.calendarEntry.findMany({
      where: and.length > 0 ? { AND: and } : {},
      take: 100,
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
      include: calendarEntryInclude
    });

    return {
      items: items.map((item) => this.mapEntry(item, actor)),
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
    const relations = await this.resolveTargetRelations(dto);
    const startsAt = this.parseDateTime(dto.startsAt, dto.notificationTime);
    const endsAt = dto.endsAt
      ? this.parseDateTime(dto.endsAt, dto.notificationTime)
      : null;
    const notificationChannels = this.normalizeChannels(
      dto.notificationChannels
    );
    const notificationScheduledAt = this.calculateNotificationScheduledAt({
      startsAt,
      policy: dto.notificationPolicy,
      offsetBusinessDays: dto.notificationOffsetBusinessDays,
      notificationTime: dto.notificationTime,
      holidayRegionCode: dto.holidayRegionCode
    });

    const created = await this.prisma.calendarEntry.create({
      data: {
        publicId: createPublicId('agi'),
        kind: dto.kind,
        status: dto.status,
        priority: dto.priority,
        targetType: relations.targetType,
        title: dto.title,
        description: this.nullIfEmpty(dto.description),
        startsAt,
        endsAt,
        timezone: dto.timezone,
        isAllDay: dto.isAllDay,
        businessDayPolicy: dto.businessDayPolicy,
        holidayRegionCode: this.nullIfEmpty(dto.holidayRegionCode),
        notificationPolicy: dto.notificationPolicy,
        notificationOffsetBusinessDays: dto.notificationOffsetBusinessDays,
        notificationTime: dto.notificationTime,
        notificationScheduledAt,
        notificationChannelsJson:
          notificationChannels as Prisma.InputJsonValue,
        personId: relations.personId,
        providerCompanyId: relations.providerCompanyId,
        clientCompanyId: relations.clientCompanyId,
        contractId: relations.contractId,
        employmentLinkId: relations.employmentLinkId,
        positionId: relations.positionId,
        createdByUserSystemId: actorUserId,
        assignedToUserSystemId: actorUserId
      },
      include: calendarEntryInclude
    });

    await this.writeAudit(
      actorUserId,
      'create',
      created.publicId,
      `Criou item de agenda ${created.title}.`
    );

    return this.mapEntry(created, actor);
  }

  async update(
    publicId: string,
    dto: UpdateCalendarEntryDto,
    actor: AuthTokenPayload
  ) {
    this.prisma.assertConfigured();

    const actorUserId = await this.resolveAuthenticatedUserId(actor.sub);
    const current = await this.ensureEntry(publicId);
    if (!this.canManage(current, actor)) {
      throw new ForbiddenException('Voce nao pode alterar este item de agenda.');
    }

    const hasRelationUpdate = this.hasRelationUpdate(dto);
    const relations = hasRelationUpdate
      ? await this.resolveTargetRelations(dto)
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
    const notificationScheduledAt = this.calculateNotificationScheduledAt({
      startsAt,
      policy: notificationPolicy,
      offsetBusinessDays: notificationOffsetBusinessDays,
      notificationTime,
      holidayRegionCode
    });

    const updated = await this.prisma.calendarEntry.update({
      where: { publicId },
      data: {
        ...(dto.kind ? { kind: dto.kind } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.priority ? { priority: dto.priority } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? { description: this.nullIfEmpty(dto.description) }
          : {}),
        startsAt,
        endsAt,
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.isAllDay !== undefined ? { isAllDay: dto.isAllDay } : {}),
        ...(dto.businessDayPolicy
          ? { businessDayPolicy: dto.businessDayPolicy }
          : {}),
        holidayRegionCode,
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
    const current = await this.ensureEntry(publicId);
    if (!this.canManage(current, actor)) {
      throw new ForbiddenException('Voce nao pode cancelar este item de agenda.');
    }

    const canceled = await this.prisma.calendarEntry.update({
      where: { publicId },
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

  private async ensureEntry(
    publicId: string
  ): Promise<CalendarEntryWithRelations> {
    const item = await this.prisma.calendarEntry.findUnique({
      where: { publicId },
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
    >
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
        ? this.prisma.person.findUnique({
            where: { publicId: dto.personPublicId },
            select: { id: true }
          })
        : null,
      dto.providerCompanyPublicId
        ? this.prisma.providerCompany.findUnique({
            where: { publicId: dto.providerCompanyPublicId },
            select: { id: true }
          })
        : null,
      dto.clientCompanyPublicId
        ? this.prisma.clientCompany.findUnique({
            where: { publicId: dto.clientCompanyPublicId },
            select: { id: true }
          })
        : null,
      dto.contractPublicId
        ? this.prisma.contract.findUnique({
            where: { publicId: dto.contractPublicId },
            select: { id: true }
          })
        : null,
      dto.employmentLinkPublicId
        ? this.prisma.employmentLink.findUnique({
            where: { publicId: dto.employmentLinkPublicId },
            select: { id: true }
          })
        : null,
      dto.positionPublicId
        ? this.prisma.position.findUnique({
            where: { publicId: dto.positionPublicId },
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
  }): Date {
    const dueDate = this.withTime(input.startsAt, input.notificationTime);

    switch (input.policy) {
      case CalendarNotificationPolicy.ONE_BUSINESS_DAY_BEFORE:
        return this.subtractBusinessDays(
          dueDate,
          1,
          input.holidayRegionCode
        );
      case CalendarNotificationPolicy.SAME_DAY_OR_PREVIOUS_BUSINESS_DAY:
        return this.isBusinessDay(dueDate, input.holidayRegionCode)
          ? dueDate
          : this.previousBusinessDay(dueDate, input.holidayRegionCode);
      case CalendarNotificationPolicy.CUSTOM_BUSINESS_DAYS_BEFORE:
        return this.subtractBusinessDays(
          dueDate,
          input.offsetBusinessDays,
          input.holidayRegionCode
        );
      case CalendarNotificationPolicy.ON_DUE_DATE:
      default:
        return dueDate;
    }
  }

  private subtractBusinessDays(
    date: Date,
    days: number,
    holidayRegionCode?: string | null
  ): Date {
    let cursor = new Date(date);
    let remaining = days;

    while (remaining > 0) {
      cursor = this.addDays(cursor, -1);
      if (this.isBusinessDay(cursor, holidayRegionCode)) {
        remaining -= 1;
      }
    }

    return cursor;
  }

  private previousBusinessDay(
    date: Date,
    holidayRegionCode?: string | null
  ): Date {
    let cursor = new Date(date);
    for (let index = 0; index < 370; index += 1) {
      if (this.isBusinessDay(cursor, holidayRegionCode)) {
        return cursor;
      }
      cursor = this.addDays(cursor, -1);
    }
    return cursor;
  }

  private isBusinessDay(date: Date, holidayRegionCode?: string | null): boolean {
    const weekday = date.getDay();
    if (weekday === 0 || weekday === 6) {
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

  private normalizeChannels(
    channels?: CalendarNotificationChannel[]
  ): CalendarNotificationChannel[] {
    const normalized: CalendarNotificationChannel[] = channels?.length
      ? channels
      : ['IN_APP'];
    const filtered = normalized.filter((channel): channel is CalendarNotificationChannel =>
      calendarNotificationChannels.includes(channel)
    );
    return filtered.length > 0 ? filtered : ['IN_APP'];
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

  private kindLabel(kind: CalendarEntryKind): string {
    return kind === CalendarEntryKind.REMINDER ? 'Lembrete' : 'Compromisso';
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

  private nullIfEmpty(value?: string | null): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
}
