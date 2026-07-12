import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import {
  AccessProfileCode,
  CalendarBusinessDayPolicy,
  CalendarEntryKind,
  CalendarEntryStatus,
  CalendarEntryTargetType,
  CalendarNotificationPolicy,
  FocusBoardCompletionMode,
  FocusBoardContextType,
  FocusBoardNoteEventType,
  FocusBoardNoteKind,
  FocusBoardNoteParticipant,
  FocusBoardNotePriority,
  FocusBoardNoteStatus,
  FocusBoardNoteVisibility,
  FocusBoardParticipantRole,
  FocusBoardParticipantType,
  Prisma,
  SensitiveAudienceGroup
} from '@prisma/client';
import { tenantCreateRelation, tenantWhere } from '../../common/tenant/tenant-scope';
import { createPublicId } from '../../common/utils/public-id';
import { rethrowPrismaError } from '../../common/utils/prisma-error';
import { PrismaService } from '../../infra/database/prisma.service';
import { AuthTokenPayload } from '../auth/interfaces/auth-token-payload.interface';
import { CreateFocusBoardNoteDto } from './dto/create-focus-board-note.dto';
import { CreateFocusBoardReminderDto } from './dto/create-focus-board-reminder.dto';
import { FocusBoardNoteContextDto } from './dto/focus-board-note-context.dto';
import { FocusBoardNoteParticipantDto } from './dto/focus-board-note-participant.dto';
import { FocusBoardNoteTransitionDto } from './dto/focus-board-note-transition.dto';
import { ListFocusBoardNotesQueryDto } from './dto/list-focus-board-notes-query.dto';
import { UpdateFocusBoardNoteDto } from './dto/update-focus-board-note.dto';

const focusBoardNoteInclude = {
  ownerUserSystem: true,
  createdByUserSystem: true,
  updatedByUserSystem: true,
  participants: {
    include: {
      userSystem: true,
      accessProfile: true,
      completedByUserSystem: true
    }
  },
  contexts: {
    include: {
      person: true,
      providerCompany: true,
      clientCompany: true,
      contract: true,
      employmentLink: {
        include: {
          person: true,
          position: true,
          contract: true,
          providerCompany: true
        }
      },
      position: true,
      timelineRecord: true,
      calendarEntry: true
    }
  },
  reminders: {
    include: {
      calendarEntry: true
    }
  }
} satisfies Prisma.FocusBoardNoteInclude;

type FocusBoardNoteWithRelations = Prisma.FocusBoardNoteGetPayload<{
  include: typeof focusBoardNoteInclude;
}>;

type FocusBoardEventWithActor = Prisma.FocusBoardNoteEventGetPayload<{
  include: { actorUserSystem: true };
}>;

type ActorUser = {
  id: bigint;
  publicId: string;
  name: string;
};

type ResolvedContext = {
  contextType: FocusBoardContextType;
  labelSnapshot: string;
  externalLabel?: string;
  personId?: bigint;
  providerCompanyId?: bigint;
  clientCompanyId?: bigint;
  contractId?: bigint;
  employmentLinkId?: bigint;
  positionId?: bigint;
  timelineRecordId?: bigint;
  calendarEntryId?: bigint;
};

type ResolvedParticipant = {
  participantType: FocusBoardParticipantType;
  role: FocusBoardParticipantRole;
  canComplete: boolean;
  requiredForCompletion: boolean;
  userSystemId?: bigint;
  accessProfileId?: bigint;
  audienceGroupKey?: SensitiveAudienceGroup;
};

type ReminderTarget = {
  targetType: CalendarEntryTargetType;
  personId?: bigint;
  providerCompanyId?: bigint;
  clientCompanyId?: bigint;
  contractId?: bigint;
  employmentLinkId?: bigint;
  positionId?: bigint;
};

@Injectable()
export class FocusBoardNotesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: ListFocusBoardNotesQueryDto, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    const where = await this.buildListWhere(query, actor);
    const take = Math.min(Math.max(Number(query.limit ?? 30), 1), 100);
    const cursor = query.cursor
      ? await this.prisma.focusBoardNote.findFirst({
          where: tenantWhere(actor, {
            publicId: query.cursor,
            AND: [this.visibilityWhere(actor)]
          }),
          select: { id: true }
        })
      : null;

    const [total, items] = await Promise.all([
      this.prisma.focusBoardNote.count({ where }),
      this.prisma.focusBoardNote.findMany({
        where,
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        include: focusBoardNoteInclude
      })
    ]);

    const pageItems = items.slice(0, take);
    const next = items.length > take ? pageItems.at(-1)?.publicId ?? null : null;

    return {
      items: pageItems.map((item) => this.mapListNote(item, actor)),
      nextCursor: next,
      meta: {
        authorizedTotal: total
      }
    };
  }

  async findOne(publicId: string, actor: AuthTokenPayload) {
    const item = await this.ensureReadableNote(publicId, actor);
    return this.mapDetailNote(item, actor);
  }

  async create(dto: CreateFocusBoardNoteDto, actor: AuthTokenPayload) {
    this.prisma.assertConfigured();

    const actorUser = await this.resolveActorUser(actor);
    const existing = await this.findExistingMigration(dto, actor, actorUser.id);
    if (existing) {
      this.assertMigrationPayloadCompatible(existing, dto);
      return this.mapDetailNote(existing, actor);
    }

    const parent = dto.parentNotePublicId
      ? await this.ensureReadableNote(dto.parentNotePublicId, actor)
      : null;
    const contexts = await this.resolveContexts(dto.contexts ?? [], actor);
    const participants = await this.resolveParticipants(
      dto.participants ?? [],
      dto.visibility,
      actor,
      actorUser.id
    );
    const dueAt = this.parseOptionalDate(dto.dueAt, 'Prazo da nota invalido.');

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const note = await tx.focusBoardNote.create({
          data: {
            publicId: createPublicId('fcn'),
            tenantRootCompany: tenantCreateRelation(actor),
            parentNote: parent ? { connect: { id: parent.id } } : undefined,
            threadRootNote: parent
              ? {
                  connect: {
                    id: parent.threadRootNoteId ?? parent.id
                  }
                }
              : undefined,
            clientMigrationId: this.nullIfEmpty(dto.clientMigrationId),
            kind: dto.kind,
            title: dto.title,
            body: this.nullIfEmpty(dto.body),
            priority: dto.priority,
            visibility: dto.visibility,
            completionMode: dto.completionMode,
            dueAt,
            createdByUserSystem: { connect: { id: actorUser.id } },
            ownerUserSystem: { connect: { id: actorUser.id } },
            participants: {
              create: participants.map((participant) =>
                this.participantCreateData(participant, actorUser.id)
              )
            },
            contexts: contexts.length
              ? {
                  create: contexts.map((context) =>
                    this.contextCreateData(context)
                  )
                }
              : undefined
          },
          include: focusBoardNoteInclude
        });

        await this.recordEvent(tx, {
          actorUserId: actorUser.id,
          tenantRootCompanyId: note.tenantRootCompanyId,
          noteId: note.id,
          notePublicId: note.publicId,
          eventType: FocusBoardNoteEventType.CREATED,
          action: 'create',
          summary: `Criou nota do Focus Board ${note.title}.`,
          after: this.auditSnapshot(note)
        });

        return note;
      });

      return this.mapDetailNote(created, actor);
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async update(
    publicId: string,
    dto: UpdateFocusBoardNoteDto,
    actor: AuthTokenPayload
  ) {
    this.prisma.assertConfigured();

    const actorUser = await this.resolveActorUser(actor);
    const current = await this.ensureReadableNote(publicId, actor);
    this.assertCanManage(current, actor);
    this.assertExpectedVersion(current, dto.expectedVersion);

    const nextVisibility = dto.visibility ?? current.visibility;
    const nextParticipants =
      dto.participants !== undefined
        ? await this.resolveParticipants(
            dto.participants,
            nextVisibility,
            actor,
            current.ownerUserSystemId
          )
        : nextVisibility === FocusBoardNoteVisibility.PRIVATE &&
            current.visibility !== FocusBoardNoteVisibility.PRIVATE
          ? this.privateParticipantsFromCurrent(current)
          : null;
    const nextContexts =
      dto.contexts !== undefined
        ? await this.resolveContexts(dto.contexts, actor)
        : null;

    const dueAtProvided = Object.prototype.hasOwnProperty.call(dto, 'dueAt');
    const bodyProvided = Object.prototype.hasOwnProperty.call(dto, 'body');
    const dueAt = dueAtProvided
      ? dto.dueAt === null
        ? null
        : this.parseOptionalDate(dto.dueAt, 'Prazo da nota invalido.')
      : undefined;

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (nextParticipants) {
          await tx.focusBoardNoteParticipant.deleteMany({
            where: { noteId: current.id }
          });
        }
        if (nextContexts) {
          await tx.focusBoardNoteContext.deleteMany({
            where: { noteId: current.id }
          });
        }

        const note = await tx.focusBoardNote.update({
          where: { id: current.id },
          data: {
            title: dto.title,
            body: bodyProvided ? this.nullIfEmpty(dto.body) : undefined,
            priority: dto.priority,
            visibility: dto.visibility,
            completionMode: dto.completionMode,
            dueAt,
            updatedByUserSystem: { connect: { id: actorUser.id } },
            lastEditJustification: this.nullIfEmpty(dto.editJustification),
            version: { increment: 1 },
            participants: nextParticipants
              ? {
                  create: nextParticipants.map((participant) =>
                    this.participantCreateData(participant, actorUser.id)
                  )
                }
              : undefined,
            contexts: nextContexts
              ? {
                  create: nextContexts.map((context) =>
                    this.contextCreateData(context)
                  )
                }
              : undefined
          },
          include: focusBoardNoteInclude
        });

        await this.recordEvent(tx, {
          actorUserId: actorUser.id,
          tenantRootCompanyId: note.tenantRootCompanyId,
          noteId: note.id,
          notePublicId: note.publicId,
          eventType:
            current.visibility !== note.visibility
              ? FocusBoardNoteEventType.VISIBILITY_CHANGED
              : nextContexts
                ? FocusBoardNoteEventType.CONTEXT_CHANGED
                : FocusBoardNoteEventType.UPDATED,
          action: 'update',
          summary: `Atualizou nota do Focus Board ${note.title}.`,
          before: this.auditSnapshot(current),
          after: this.auditSnapshot(note)
        });

        return note;
      });

      return this.mapDetailNote(updated, actor);
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async complete(
    publicId: string,
    dto: FocusBoardNoteTransitionDto,
    actor: AuthTokenPayload
  ) {
    const current = await this.ensureReadableNote(publicId, actor);
    this.assertExpectedVersion(current, dto.expectedVersion);
    if (!this.canComplete(current, actor)) {
      throw new ForbiddenException('Usuario sem permissao para concluir a nota.');
    }

    const actorUser = await this.resolveActorUser(actor);
    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.markActorParticipantCompleted(tx, current, actor, actorUser.id, now);
      const shouldComplete =
        current.completionMode !== FocusBoardCompletionMode.ALL_MUST_COMPLETE ||
        this.allRequiredParticipantsCompleted(current, actor);

      const note = await tx.focusBoardNote.update({
        where: { id: current.id },
        data: shouldComplete
          ? {
              status: FocusBoardNoteStatus.COMPLETED,
              previousStatus: current.status,
              completedAt: now,
              updatedByUserSystemId: actorUser.id,
              version: { increment: 1 }
            }
          : {
              updatedByUserSystemId: actorUser.id,
              version: { increment: 1 }
            },
        include: focusBoardNoteInclude
      });

      await this.recordEvent(tx, {
        actorUserId: actorUser.id,
        tenantRootCompanyId: note.tenantRootCompanyId,
        noteId: note.id,
        notePublicId: note.publicId,
        eventType: FocusBoardNoteEventType.COMPLETED,
        action: 'complete',
        summary: dto.reason || `Concluiu nota do Focus Board ${note.title}.`,
        before: this.auditSnapshot(current),
        after: this.auditSnapshot(note)
      });

      return note;
    });

    return this.mapDetailNote(updated, actor);
  }

  async reopen(
    publicId: string,
    dto: FocusBoardNoteTransitionDto,
    actor: AuthTokenPayload
  ) {
    return this.statusTransition(publicId, dto, actor, {
      status: FocusBoardNoteStatus.ACTIVE,
      eventType: FocusBoardNoteEventType.REOPENED,
      action: 'reopen',
      summary: 'Reabriu nota do Focus Board.',
      extraData: {
        completedAt: null,
        previousStatus: null,
        participants: {
          updateMany: {
            where: {},
            data: { completedAt: null, completedByUserSystemId: null }
          }
        }
      }
    });
  }

  async archive(
    publicId: string,
    dto: FocusBoardNoteTransitionDto,
    actor: AuthTokenPayload
  ) {
    return this.statusTransition(publicId, dto, actor, {
      status: FocusBoardNoteStatus.ARCHIVED,
      eventType: FocusBoardNoteEventType.ARCHIVED,
      action: 'archive',
      summary: 'Arquivou nota do Focus Board.',
      dateField: 'archivedAt'
    });
  }

  async trash(
    publicId: string,
    dto: FocusBoardNoteTransitionDto,
    actor: AuthTokenPayload
  ) {
    return this.statusTransition(publicId, dto, actor, {
      status: FocusBoardNoteStatus.TRASHED,
      eventType: FocusBoardNoteEventType.TRASHED,
      action: 'trash',
      summary: 'Moveu nota do Focus Board para lixeira.',
      dateField: 'trashedAt'
    });
  }

  async restore(
    publicId: string,
    dto: FocusBoardNoteTransitionDto,
    actor: AuthTokenPayload
  ) {
    const current = await this.ensureReadableNote(publicId, actor);
    const target =
      current.previousStatus &&
      current.previousStatus !== FocusBoardNoteStatus.DELETED &&
      current.previousStatus !== FocusBoardNoteStatus.TRASHED
        ? current.previousStatus
        : FocusBoardNoteStatus.ACTIVE;

    return this.statusTransition(publicId, dto, actor, {
      status: target,
      eventType: FocusBoardNoteEventType.RESTORED,
      action: 'restore',
      summary: 'Restaurou nota do Focus Board.',
      extraData: {
        previousStatus: null,
        trashedAt: null
      },
      current
    });
  }

  async remove(
    publicId: string,
    dto: FocusBoardNoteTransitionDto,
    actor: AuthTokenPayload
  ) {
    return this.statusTransition(publicId, dto, actor, {
      status: FocusBoardNoteStatus.DELETED,
      eventType: FocusBoardNoteEventType.DELETED,
      action: 'delete',
      summary: 'Removeu logicamente nota do Focus Board.',
      dateField: 'deletedAt'
    });
  }

  async listEvents(publicId: string, actor: AuthTokenPayload) {
    const note = await this.ensureReadableNote(publicId, actor);
    const items = await this.prisma.focusBoardNoteEvent.findMany({
      where: tenantWhere(actor, { noteId: note.id }),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
      include: { actorUserSystem: true }
    });

    return {
      items: items.map((item) => this.mapEvent(item)),
      meta: { authorizedTotal: items.length }
    };
  }

  async createReminder(
    publicId: string,
    dto: CreateFocusBoardReminderDto,
    actor: AuthTokenPayload
  ) {
    const current = await this.ensureReadableNote(publicId, actor);
    this.assertCanManage(current, actor);
    const actorUser = await this.resolveActorUser(actor);
    const startsAt = this.parseRequiredDate(dto.startsAt, 'Data inicial invalida.');
    const endsAt = dto.endsAt
      ? this.parseRequiredDate(dto.endsAt, 'Data final invalida.')
      : null;
    const target = this.reminderTargetFromNote(current);

    const reminder = await this.prisma.$transaction(async (tx) => {
      const calendarEntry = await tx.calendarEntry.create({
        data: {
          publicId: createPublicId('agi'),
          tenantRootCompany: tenantCreateRelation(actor),
          kind: CalendarEntryKind.REMINDER,
          status: CalendarEntryStatus.SCHEDULED,
          priority: dto.priority,
          targetType: target.targetType,
          category: 'FOCUS_BOARD',
          title: dto.title,
          description: this.nullIfEmpty(dto.description),
          startsAt,
          endsAt,
          timezone: dto.timezone,
          isAllDay: dto.isAllDay,
          businessDayPolicy: CalendarBusinessDayPolicy.ALLOW_NON_BUSINESS_DAY,
          notificationPolicy: dto.notificationPolicy,
          notificationTime: dto.notificationTime,
          notificationChannelsJson: ['IN_APP'] as Prisma.InputJsonValue,
          person: target.personId ? { connect: { id: target.personId } } : undefined,
          providerCompany: target.providerCompanyId
            ? { connect: { id: target.providerCompanyId } }
            : undefined,
          clientCompany: target.clientCompanyId
            ? { connect: { id: target.clientCompanyId } }
            : undefined,
          contract: target.contractId
            ? { connect: { id: target.contractId } }
            : undefined,
          employmentLink: target.employmentLinkId
            ? { connect: { id: target.employmentLinkId } }
            : undefined,
          position: target.positionId
            ? { connect: { id: target.positionId } }
            : undefined,
          createdByUserSystem: { connect: { id: actorUser.id } },
          assignedToUserSystem: { connect: { id: actorUser.id } }
        }
      });

      const item = await tx.focusBoardNoteReminder.create({
        data: {
          publicId: createPublicId('fcr'),
          note: { connect: { id: current.id } },
          calendarEntry: { connect: { id: calendarEntry.id } },
          createdByUserSystem: { connect: { id: actorUser.id } }
        },
        include: { calendarEntry: true }
      });

      await this.recordEvent(tx, {
        actorUserId: actorUser.id,
        tenantRootCompanyId: current.tenantRootCompanyId,
        noteId: current.id,
        notePublicId: current.publicId,
        eventType: FocusBoardNoteEventType.REMINDER_LINKED,
        action: 'reminder_linked',
        summary: `Criou lembrete ${calendarEntry.title} para nota do Focus Board.`
      });

      return item;
    });

    return {
      publicId: reminder.publicId,
      calendarEntry: {
        publicId: reminder.calendarEntry.publicId,
        title: reminder.calendarEntry.title,
        startsAt: reminder.calendarEntry.startsAt,
        status: reminder.calendarEntry.status
      }
    };
  }

  async cancelReminder(
    publicId: string,
    reminderPublicId: string,
    actor: AuthTokenPayload
  ) {
    const current = await this.ensureReadableNote(publicId, actor);
    this.assertCanManage(current, actor);
    const actorUser = await this.resolveActorUser(actor);

    const reminder = await this.prisma.focusBoardNoteReminder.findFirst({
      where: { publicId: reminderPublicId, noteId: current.id },
      include: { calendarEntry: true }
    });
    if (!reminder) {
      throw new NotFoundException('Lembrete da nota nao encontrado.');
    }

    const canceled = await this.prisma.$transaction(async (tx) => {
      const calendarEntry = await tx.calendarEntry.update({
        where: { id: reminder.calendarEntryId },
        data: {
          status: CalendarEntryStatus.CANCELED,
          canceledAt: new Date(),
          updatedByUserSystemId: actorUser.id
        }
      });

      await this.recordEvent(tx, {
        actorUserId: actorUser.id,
        tenantRootCompanyId: current.tenantRootCompanyId,
        noteId: current.id,
        notePublicId: current.publicId,
        eventType: FocusBoardNoteEventType.REMINDER_CANCELED,
        action: 'reminder_canceled',
        summary: `Cancelou lembrete ${calendarEntry.title} da nota do Focus Board.`
      });

      return calendarEntry;
    });

    return {
      publicId: reminder.publicId,
      calendarEntry: {
        publicId: canceled.publicId,
        title: canceled.title,
        status: canceled.status,
        canceledAt: canceled.canceledAt
      }
    };
  }

  private async buildListWhere(
    query: ListFocusBoardNotesQueryDto,
    actor: AuthTokenPayload
  ): Promise<Prisma.FocusBoardNoteWhereInput> {
    const and: Prisma.FocusBoardNoteWhereInput[] = [this.visibilityWhere(actor)];
    and.push({ status: query.status ?? FocusBoardNoteStatus.ACTIVE });
    if (query.kind) {
      and.push({ kind: query.kind });
    }
    if (query.visibility) {
      and.push({ visibility: query.visibility });
    }
    if (query.priority) {
      and.push({ priority: query.priority });
    }
    if (query.search?.trim()) {
      const search = query.search.trim();
      and.push({
        OR: [{ title: { contains: search } }, { body: { contains: search } }]
      });
    }
    const dueRange = this.dateRange(query.dueFrom, query.dueTo, 'Periodo invalido.');
    if (dueRange) {
      and.push({ dueAt: dueRange });
    }
    const updatedAfter = this.parseOptionalDate(
      query.updatedAfter,
      'Data de atualizacao invalida.'
    );
    if (updatedAfter) {
      and.push({ updatedAt: { gte: updatedAfter } });
    }
    if (query.contextType) {
      and.push({
        contexts: {
          some: await this.contextFilter(query.contextType, query.contextPublicId)
        }
      });
    }

    return tenantWhere(actor, { AND: and }) ?? { AND: and };
  }

  private visibilityWhere(actor: AuthTokenPayload): Prisma.FocusBoardNoteWhereInput {
    const profileCodes = this.actorProfileCodes(actor);
    const audienceGroups = actor.audienceGroups ?? [];
    const or: Prisma.FocusBoardNoteWhereInput[] = [
      { ownerUserSystem: { publicId: actor.sub } },
      { participants: { some: { userSystem: { publicId: actor.sub } } } }
    ];

    if (profileCodes.length > 0) {
      or.push({
        visibility: FocusBoardNoteVisibility.SHARED,
        participants: {
          some: { accessProfile: { code: { in: profileCodes } } }
        }
      });
    }
    if (audienceGroups.length > 0) {
      or.push({
        visibility: FocusBoardNoteVisibility.SHARED,
        participants: {
          some: { audienceGroupKey: { in: audienceGroups } }
        }
      });
    }

    return { OR: or };
  }

  private async ensureReadableNote(publicId: string, actor: AuthTokenPayload) {
    const item = await this.prisma.focusBoardNote.findFirst({
      where: tenantWhere(actor, {
        publicId,
        status: { not: FocusBoardNoteStatus.DELETED },
        AND: [this.visibilityWhere(actor)]
      }),
      include: focusBoardNoteInclude
    });

    if (!item) {
      throw new NotFoundException('Nota do Focus Board nao encontrada.');
    }

    return item;
  }

  private async resolveActorUser(actor: AuthTokenPayload): Promise<ActorUser> {
    const user = await this.prisma.userSystem.findUnique({
      where: { publicId: actor.sub },
      select: { id: true, publicId: true, name: true }
    });

    if (!user) {
      throw new UnauthorizedException(
        'Usuario autenticado nao foi encontrado para registrar a nota.'
      );
    }

    return user;
  }

  private async findExistingMigration(
    dto: CreateFocusBoardNoteDto,
    actor: AuthTokenPayload,
    ownerUserSystemId: bigint
  ) {
    if (!dto.clientMigrationId?.trim()) {
      return null;
    }

    return this.prisma.focusBoardNote.findFirst({
      where: tenantWhere(actor, {
        ownerUserSystemId,
        clientMigrationId: dto.clientMigrationId.trim()
      }),
      include: focusBoardNoteInclude
    });
  }

  private assertMigrationPayloadCompatible(
    item: FocusBoardNoteWithRelations,
    dto: CreateFocusBoardNoteDto
  ) {
    const body = this.nullIfEmpty(dto.body);
    const dueAt = this.parseOptionalDate(dto.dueAt, 'Prazo da nota invalido.');
    const dueMatches =
      (!item.dueAt && !dueAt) ||
      (item.dueAt && dueAt && item.dueAt.getTime() === dueAt.getTime());
    if (
      item.kind !== dto.kind ||
      item.title !== dto.title ||
      (item.body ?? null) !== body ||
      item.priority !== dto.priority ||
      item.visibility !== dto.visibility ||
      item.completionMode !== dto.completionMode ||
      !dueMatches
    ) {
      throw new ConflictException(
        'Nota local ja migrada com payload diferente.'
      );
    }
  }

  private async resolveContexts(
    dtos: FocusBoardNoteContextDto[],
    actor: AuthTokenPayload
  ): Promise<ResolvedContext[]> {
    const contexts: ResolvedContext[] = [];
    for (const dto of dtos) {
      contexts.push(await this.resolveContext(dto, actor));
    }
    return contexts;
  }

  private async resolveContext(
    dto: FocusBoardNoteContextDto,
    actor: AuthTokenPayload
  ): Promise<ResolvedContext> {
    if (dto.contextType === FocusBoardContextType.OTHER) {
      if (!dto.externalLabel?.trim()) {
        throw new BadRequestException('Contexto OTHER exige externalLabel.');
      }
      return {
        contextType: dto.contextType,
        externalLabel: dto.externalLabel.trim(),
        labelSnapshot: dto.externalLabel.trim()
      };
    }

    if (!dto.contextPublicId?.trim()) {
      throw new BadRequestException('Contexto exige contextPublicId.');
    }

    const publicId = dto.contextPublicId.trim();
    switch (dto.contextType) {
      case FocusBoardContextType.PERSON: {
        const item = await this.prisma.person.findFirst({
          where: tenantWhere(actor, { publicId }),
          select: { id: true, name: true }
        });
        this.assertContextFound(item, 'Pessoa');
        return {
          contextType: dto.contextType,
          personId: item.id,
          labelSnapshot: item.name
        };
      }
      case FocusBoardContextType.PROVIDER_COMPANY: {
        const item = await this.prisma.providerCompany.findFirst({
          where: tenantWhere(actor, { publicId }),
          select: { id: true, legalName: true, tradeName: true }
        });
        this.assertContextFound(item, 'Empresa prestadora');
        return {
          contextType: dto.contextType,
          providerCompanyId: item.id,
          labelSnapshot: item.tradeName || item.legalName
        };
      }
      case FocusBoardContextType.CLIENT_COMPANY: {
        const item = await this.prisma.clientCompany.findFirst({
          where: tenantWhere(actor, { publicId }),
          select: { id: true, name: true }
        });
        this.assertContextFound(item, 'Cliente');
        return {
          contextType: dto.contextType,
          clientCompanyId: item.id,
          labelSnapshot: item.name
        };
      }
      case FocusBoardContextType.CONTRACT: {
        const item = await this.prisma.contract.findFirst({
          where: tenantWhere(actor, { publicId }),
          include: { clientCompany: true, providerCompany: true }
        });
        this.assertContextFound(item, 'Contrato');
        return {
          contextType: dto.contextType,
          contractId: item.id,
          labelSnapshot: `${item.clientCompany.name} / ${
            item.providerCompany.tradeName || item.providerCompany.legalName
          }`
        };
      }
      case FocusBoardContextType.EMPLOYMENT_LINK: {
        const item = await this.prisma.employmentLink.findFirst({
          where: tenantWhere(actor, { publicId }),
          include: { person: true, position: true }
        });
        this.assertContextFound(item, 'Vinculo');
        return {
          contextType: dto.contextType,
          employmentLinkId: item.id,
          labelSnapshot: `${item.person.name} / ${item.position.name}`
        };
      }
      case FocusBoardContextType.POSITION: {
        const item = await this.prisma.position.findFirst({
          where: tenantWhere(actor, { publicId }),
          select: { id: true, name: true }
        });
        this.assertContextFound(item, 'Posto');
        return {
          contextType: dto.contextType,
          positionId: item.id,
          labelSnapshot: item.name
        };
      }
      case FocusBoardContextType.TIMELINE_RECORD: {
        const item = await this.prisma.timelineRecord.findFirst({
          where: tenantWhere(actor, { publicId }),
          select: { id: true, title: true }
        });
        this.assertContextFound(item, 'Registro de timeline');
        return {
          contextType: dto.contextType,
          timelineRecordId: item.id,
          labelSnapshot: item.title
        };
      }
      case FocusBoardContextType.CALENDAR_ENTRY: {
        const item = await this.prisma.calendarEntry.findFirst({
          where: tenantWhere(actor, { publicId }),
          select: { id: true, title: true }
        });
        this.assertContextFound(item, 'Item de agenda');
        return {
          contextType: dto.contextType,
          calendarEntryId: item.id,
          labelSnapshot: item.title
        };
      }
    }
  }

  private async resolveParticipants(
    dtos: FocusBoardNoteParticipantDto[],
    visibility: FocusBoardNoteVisibility,
    actor: AuthTokenPayload,
    ownerUserSystemId: bigint
  ): Promise<ResolvedParticipant[]> {
    const participants = new Map<string, ResolvedParticipant>();
    participants.set(`user:${ownerUserSystemId}`, {
      participantType: FocusBoardParticipantType.USER,
      role: FocusBoardParticipantRole.OWNER,
      canComplete: true,
      requiredForCompletion: false,
      userSystemId: ownerUserSystemId
    });

    for (const dto of dtos) {
      const participant = await this.resolveParticipant(dto, visibility, actor);
      const key = this.participantKey(participant);
      if (key === `user:${ownerUserSystemId}`) {
        continue;
      }
      participants.set(key, participant);
    }

    if (
      visibility === FocusBoardNoteVisibility.SHARED &&
      participants.size <= 1
    ) {
      throw new BadRequestException(
        'Nota compartilhada exige ao menos um participante alem da autoria.'
      );
    }

    return [...participants.values()];
  }

  private async resolveParticipant(
    dto: FocusBoardNoteParticipantDto,
    visibility: FocusBoardNoteVisibility,
    actor: AuthTokenPayload
  ): Promise<ResolvedParticipant> {
    const targets = [
      dto.userPublicId,
      dto.accessProfilePublicId,
      dto.audienceGroupKey
    ].filter(Boolean);
    if (targets.length !== 1) {
      throw new BadRequestException(
        'Participante deve informar exatamente um usuario, perfil ou grupo.'
      );
    }

    if (
      visibility === FocusBoardNoteVisibility.PRIVATE &&
      dto.participantType !== FocusBoardParticipantType.USER
    ) {
      throw new BadRequestException(
        'Nota privada aceita apenas participantes de usuario explicitos.'
      );
    }

    if (dto.participantType === FocusBoardParticipantType.USER) {
      if (!dto.userPublicId) {
        throw new BadRequestException('Participante USER exige userPublicId.');
      }
      const user = await this.prisma.userSystem.findFirst({
        where: tenantWhere(actor, { publicId: dto.userPublicId }),
        select: { id: true }
      });
      this.assertContextFound(user, 'Usuario participante');
      return {
        participantType: dto.participantType,
        userSystemId: user.id,
        role: this.safeParticipantRole(dto.role),
        canComplete: dto.canComplete,
        requiredForCompletion: dto.requiredForCompletion
      };
    }

    if (dto.participantType === FocusBoardParticipantType.ACCESS_PROFILE) {
      if (!dto.accessProfilePublicId) {
        throw new BadRequestException(
          'Participante ACCESS_PROFILE exige accessProfilePublicId.'
        );
      }
      const profile = await this.prisma.accessProfile.findUnique({
        where: { publicId: dto.accessProfilePublicId },
        select: { id: true }
      });
      this.assertContextFound(profile, 'Perfil participante');
      return {
        participantType: dto.participantType,
        accessProfileId: profile.id,
        role: this.safeParticipantRole(dto.role),
        canComplete: dto.canComplete,
        requiredForCompletion: dto.requiredForCompletion
      };
    }

    if (!dto.audienceGroupKey) {
      throw new BadRequestException(
        'Participante SENSITIVE_AUDIENCE_GROUP exige audienceGroupKey.'
      );
    }
    return {
      participantType: dto.participantType,
      audienceGroupKey: dto.audienceGroupKey,
      role: this.safeParticipantRole(dto.role),
      canComplete: dto.canComplete,
      requiredForCompletion: dto.requiredForCompletion
    };
  }

  private safeParticipantRole(role: FocusBoardParticipantRole) {
    return role === FocusBoardParticipantRole.OWNER
      ? FocusBoardParticipantRole.VIEWER
      : role;
  }

  private privateParticipantsFromCurrent(
    item: FocusBoardNoteWithRelations
  ): ResolvedParticipant[] {
    return item.participants
      .filter((participant) => participant.userSystemId)
      .map((participant) => ({
        participantType: FocusBoardParticipantType.USER,
        userSystemId: participant.userSystemId!,
        role: participant.role,
        canComplete: participant.canComplete,
        requiredForCompletion: participant.requiredForCompletion
      }));
  }

  private participantCreateData(
    participant: ResolvedParticipant,
    actorUserSystemId: bigint
  ): Prisma.FocusBoardNoteParticipantCreateWithoutNoteInput {
    return {
      publicId: createPublicId('fcp'),
      participantType: participant.participantType,
      role: participant.role,
      canComplete: participant.canComplete,
      requiredForCompletion: participant.requiredForCompletion,
      userSystem: participant.userSystemId
        ? { connect: { id: participant.userSystemId } }
        : undefined,
      accessProfile: participant.accessProfileId
        ? { connect: { id: participant.accessProfileId } }
        : undefined,
      audienceGroupKey: participant.audienceGroupKey,
      createdByUserSystem: { connect: { id: actorUserSystemId } }
    };
  }

  private contextCreateData(
    context: ResolvedContext
  ): Prisma.FocusBoardNoteContextCreateWithoutNoteInput {
    return {
      publicId: createPublicId('fcx'),
      contextType: context.contextType,
      labelSnapshot: context.labelSnapshot,
      externalLabel: context.externalLabel,
      person: context.personId ? { connect: { id: context.personId } } : undefined,
      providerCompany: context.providerCompanyId
        ? { connect: { id: context.providerCompanyId } }
        : undefined,
      clientCompany: context.clientCompanyId
        ? { connect: { id: context.clientCompanyId } }
        : undefined,
      contract: context.contractId
        ? { connect: { id: context.contractId } }
        : undefined,
      employmentLink: context.employmentLinkId
        ? { connect: { id: context.employmentLinkId } }
        : undefined,
      position: context.positionId
        ? { connect: { id: context.positionId } }
        : undefined,
      timelineRecord: context.timelineRecordId
        ? { connect: { id: context.timelineRecordId } }
        : undefined,
      calendarEntry: context.calendarEntryId
        ? { connect: { id: context.calendarEntryId } }
        : undefined
    };
  }

  private async statusTransition(
    publicId: string,
    dto: FocusBoardNoteTransitionDto,
    actor: AuthTokenPayload,
    input: {
      status: FocusBoardNoteStatus;
      eventType: FocusBoardNoteEventType;
      action: string;
      summary: string;
      dateField?: 'archivedAt' | 'trashedAt' | 'deletedAt';
      extraData?: Prisma.FocusBoardNoteUpdateInput;
      current?: FocusBoardNoteWithRelations;
    }
  ) {
    const current = input.current ?? (await this.ensureReadableNote(publicId, actor));
    this.assertCanManage(current, actor);
    this.assertExpectedVersion(current, dto.expectedVersion);
    if (current.status === FocusBoardNoteStatus.DELETED) {
      throw new BadRequestException('Nota removida nao aceita transicao.');
    }

    const actorUser = await this.resolveActorUser(actor);
    const now = new Date();
    const dateUpdate = input.dateField ? { [input.dateField]: now } : {};

    const updated = await this.prisma.$transaction(async (tx) => {
      const note = await tx.focusBoardNote.update({
        where: { id: current.id },
        data: {
          status: input.status,
          previousStatus:
            input.status === FocusBoardNoteStatus.TRASHED ||
            input.status === FocusBoardNoteStatus.ARCHIVED ||
            input.status === FocusBoardNoteStatus.DELETED
              ? current.status
              : undefined,
          updatedByUserSystem: { connect: { id: actorUser.id } },
          version: { increment: 1 },
          ...dateUpdate,
          ...input.extraData
        },
        include: focusBoardNoteInclude
      });

      await this.recordEvent(tx, {
        actorUserId: actorUser.id,
        tenantRootCompanyId: note.tenantRootCompanyId,
        noteId: note.id,
        notePublicId: note.publicId,
        eventType: input.eventType,
        action: input.action,
        summary: dto.reason || input.summary,
        before: this.auditSnapshot(current),
        after: this.auditSnapshot(note)
      });

      return note;
    });

    return this.mapDetailNote(updated, actor);
  }

  private assertCanManage(item: FocusBoardNoteWithRelations, actor: AuthTokenPayload) {
    if (!this.canManage(item, actor)) {
      throw new ForbiddenException('Usuario sem permissao para gerir esta nota.');
    }
  }

  private canManage(item: FocusBoardNoteWithRelations, actor: AuthTokenPayload) {
    if (item.ownerUserSystem.publicId === actor.sub) {
      return true;
    }
    return item.participants.some(
      (participant) =>
        participant.role === FocusBoardParticipantRole.EDITOR &&
        this.participantMatchesActor(participant, actor)
    );
  }

  private canComplete(item: FocusBoardNoteWithRelations, actor: AuthTokenPayload) {
    if (item.ownerUserSystem.publicId === actor.sub) {
      return true;
    }
    return item.participants.some(
      (participant) =>
        participant.canComplete && this.participantMatchesActor(participant, actor)
    );
  }

  private participantMatchesActor(
    participant: FocusBoardNoteParticipant,
    actor: AuthTokenPayload
  ) {
    if (participant.userSystemId && participant.userSystemId === undefined) {
      return false;
    }
    if ('userSystem' in participant) {
      const withUser = participant as FocusBoardNoteWithRelations['participants'][number];
      if (withUser.userSystem?.publicId === actor.sub) {
        return true;
      }
      if (
        withUser.accessProfile?.code &&
        this.actorProfileCodes(actor).includes(withUser.accessProfile.code)
      ) {
        return true;
      }
    }
    return participant.audienceGroupKey
      ? actor.audienceGroups.includes(participant.audienceGroupKey)
      : false;
  }

  private async markActorParticipantCompleted(
    tx: Prisma.TransactionClient,
    item: FocusBoardNoteWithRelations,
    actor: AuthTokenPayload,
    actorUserId: bigint,
    completedAt: Date
  ) {
    const participant = item.participants.find(
      (entry) =>
        entry.canComplete &&
        this.participantMatchesActor(entry, actor) &&
        !entry.completedAt
    );
    if (!participant) {
      return;
    }
    await tx.focusBoardNoteParticipant.update({
      where: { id: participant.id },
      data: { completedAt, completedByUserSystemId: actorUserId }
    });
  }

  private allRequiredParticipantsCompleted(
    item: FocusBoardNoteWithRelations,
    actor: AuthTokenPayload
  ) {
    const required = item.participants.filter(
      (participant) => participant.requiredForCompletion || participant.canComplete
    );
    if (required.length === 0) {
      return true;
    }
    return required.every(
      (participant) =>
        participant.completedAt || this.participantMatchesActor(participant, actor)
    );
  }

  private assertExpectedVersion(
    item: FocusBoardNoteWithRelations,
    expectedVersion?: number
  ) {
    if (expectedVersion && item.version !== expectedVersion) {
      throw new ConflictException('Versao da nota divergente.');
    }
  }

  private async contextFilter(
    contextType: FocusBoardContextType,
    contextPublicId?: string
  ): Promise<Prisma.FocusBoardNoteContextWhereInput> {
    if (!contextPublicId) {
      return { contextType };
    }
    const publicId = contextPublicId.trim();
    const relation = (() => {
      switch (contextType) {
        case FocusBoardContextType.PERSON:
          return { person: { publicId } };
        case FocusBoardContextType.PROVIDER_COMPANY:
          return { providerCompany: { publicId } };
        case FocusBoardContextType.CLIENT_COMPANY:
          return { clientCompany: { publicId } };
        case FocusBoardContextType.CONTRACT:
          return { contract: { publicId } };
        case FocusBoardContextType.EMPLOYMENT_LINK:
          return { employmentLink: { publicId } };
        case FocusBoardContextType.POSITION:
          return { position: { publicId } };
        case FocusBoardContextType.TIMELINE_RECORD:
          return { timelineRecord: { publicId } };
        case FocusBoardContextType.CALENDAR_ENTRY:
          return { calendarEntry: { publicId } };
        case FocusBoardContextType.OTHER:
          return { externalLabel: { contains: publicId } };
      }
    })();
    return { contextType, ...relation };
  }

  private reminderTargetFromNote(item: FocusBoardNoteWithRelations): ReminderTarget {
    for (const context of item.contexts) {
      if (context.personId) {
        return { targetType: CalendarEntryTargetType.PERSON, personId: context.personId };
      }
      if (context.employmentLinkId) {
        return {
          targetType: CalendarEntryTargetType.EMPLOYMENT_LINK,
          employmentLinkId: context.employmentLinkId
        };
      }
      if (context.contractId) {
        return { targetType: CalendarEntryTargetType.CONTRACT, contractId: context.contractId };
      }
      if (context.positionId) {
        return { targetType: CalendarEntryTargetType.POSITION, positionId: context.positionId };
      }
      if (context.providerCompanyId) {
        return {
          targetType: CalendarEntryTargetType.PROVIDER_COMPANY,
          providerCompanyId: context.providerCompanyId
        };
      }
      if (context.clientCompanyId) {
        return {
          targetType: CalendarEntryTargetType.CLIENT_COMPANY,
          clientCompanyId: context.clientCompanyId
        };
      }
    }
    return { targetType: CalendarEntryTargetType.GENERAL };
  }

  private async recordEvent(
    tx: Prisma.TransactionClient,
    input: {
      actorUserId: bigint;
      tenantRootCompanyId: bigint | null;
      noteId: bigint;
      notePublicId: string;
      eventType: FocusBoardNoteEventType;
      action: string;
      summary: string;
      before?: Prisma.InputJsonValue;
      after?: Prisma.InputJsonValue;
    }
  ) {
    await tx.focusBoardNoteEvent.create({
      data: {
        publicId: createPublicId('fce'),
        tenantRootCompanyId: input.tenantRootCompanyId ?? undefined,
        noteId: input.noteId,
        actorUserSystemId: input.actorUserId,
        eventType: input.eventType,
        summary: input.summary,
        beforeJson: input.before,
        afterJson: input.after
      }
    });
    await tx.auditLog.create({
      data: {
        publicId: createPublicId('aud'),
        tenantRootCompanyId: input.tenantRootCompanyId ?? undefined,
        userSystemId: input.actorUserId,
        entityName: 'focus_board_note',
        entityPublicId: input.notePublicId,
        action: input.action,
        description: input.summary
      }
    });
  }

  private mapListNote(item: FocusBoardNoteWithRelations, actor: AuthTokenPayload) {
    const bodyPreview = item.body
      ? item.body.length > 160
        ? `${item.body.slice(0, 157)}...`
        : item.body
      : null;
    return {
      publicId: item.publicId,
      kind: item.kind,
      title: item.title,
      bodyPreview,
      status: item.status,
      priority: item.priority,
      visibility: item.visibility,
      dueAt: item.dueAt,
      contexts: item.contexts.map((context) => this.mapContext(context)),
      participantsSummary: this.participantsSummary(item),
      permissions: this.permissions(item, actor),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      version: item.version
    };
  }

  private mapDetailNote(item: FocusBoardNoteWithRelations, actor: AuthTokenPayload) {
    return {
      ...this.mapListNote(item, actor),
      body: item.body,
      completionMode: item.completionMode,
      completedAt: item.completedAt,
      archivedAt: item.archivedAt,
      trashedAt: item.trashedAt,
      owner: {
        publicId: item.ownerUserSystem.publicId,
        name: item.ownerUserSystem.name
      },
      participants: item.participants.map((participant) => ({
        publicId: participant.publicId,
        participantType: participant.participantType,
        role: participant.role,
        canComplete: participant.canComplete,
        requiredForCompletion: participant.requiredForCompletion,
        completedAt: participant.completedAt,
        user: participant.userSystem
          ? {
              publicId: participant.userSystem.publicId,
              name: participant.userSystem.name
            }
          : null,
        accessProfile: participant.accessProfile
          ? {
              publicId: participant.accessProfile.publicId,
              code: participant.accessProfile.code,
              name: participant.accessProfile.name
            }
          : null,
        audienceGroupKey: participant.audienceGroupKey
      })),
      reminders: item.reminders.map((reminder) => ({
        publicId: reminder.publicId,
        calendarEntry: {
          publicId: reminder.calendarEntry.publicId,
          title: reminder.calendarEntry.title,
          startsAt: reminder.calendarEntry.startsAt,
          status: reminder.calendarEntry.status
        }
      }))
    };
  }

  private mapContext(context: FocusBoardNoteWithRelations['contexts'][number]) {
    return {
      publicId: context.publicId,
      contextType: context.contextType,
      label: context.labelSnapshot,
      entityPublicId:
        context.person?.publicId ??
        context.providerCompany?.publicId ??
        context.clientCompany?.publicId ??
        context.contract?.publicId ??
        context.employmentLink?.publicId ??
        context.position?.publicId ??
        context.timelineRecord?.publicId ??
        context.calendarEntry?.publicId ??
        null
    };
  }

  private mapEvent(item: FocusBoardEventWithActor) {
    return {
      publicId: item.publicId,
      eventType: item.eventType,
      summary: item.summary,
      actorName: item.actorUserSystem?.name ?? 'Sistema',
      createdAt: item.createdAt
    };
  }

  private permissions(item: FocusBoardNoteWithRelations, actor: AuthTokenPayload) {
    const canEdit = this.canManage(item, actor);
    return {
      canRead: true,
      canEdit,
      canComplete: this.canComplete(item, actor),
      canArchive: canEdit,
      canTrash: canEdit,
      canRestore: canEdit,
      canDelete: canEdit
    };
  }

  private participantsSummary(item: FocusBoardNoteWithRelations) {
    const completable = item.participants.filter(
      (participant) => participant.canComplete || participant.requiredForCompletion
    );
    return {
      authorizedCount: item.participants.length,
      completedCount: completable.filter((participant) => participant.completedAt).length
    };
  }

  private auditSnapshot(item: FocusBoardNoteWithRelations): Prisma.InputJsonValue {
    return {
      publicId: item.publicId,
      kind: item.kind,
      status: item.status,
      priority: item.priority,
      visibility: item.visibility,
      title: item.title,
      version: item.version
    };
  }

  private actorProfileCodes(actor: AuthTokenPayload): AccessProfileCode[] {
    return actor.profiles
      .map((profile) => profile as AccessProfileCode)
      .filter((profile) =>
        Object.values(AccessProfileCode).includes(profile)
      );
  }

  private participantKey(participant: ResolvedParticipant) {
    if (participant.userSystemId) {
      return `user:${participant.userSystemId}`;
    }
    if (participant.accessProfileId) {
      return `profile:${participant.accessProfileId}`;
    }
    return `group:${participant.audienceGroupKey}`;
  }

  private assertContextFound<T>(item: T | null, label: string): asserts item is T {
    if (!item) {
      throw new NotFoundException(`${label} informado(a) nao encontrado(a).`);
    }
  }

  private parseRequiredDate(value: string, message: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(message);
    }
    return parsed;
  }

  private parseOptionalDate(value: string | null | undefined, message: string) {
    if (value === undefined || value === null || value.trim() === '') {
      return value === null ? null : undefined;
    }
    return this.parseRequiredDate(value, message);
  }

  private dateRange(from?: string, to?: string, message = 'Periodo invalido.') {
    const gte = this.parseOptionalDate(from, message) ?? undefined;
    const lte = this.parseOptionalDate(to, message) ?? undefined;
    if (gte && lte && gte > lte) {
      throw new BadRequestException(message);
    }
    return gte || lte ? { gte, lte } : undefined;
  }

  private nullIfEmpty(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    return value.trim() || null;
  }
}
