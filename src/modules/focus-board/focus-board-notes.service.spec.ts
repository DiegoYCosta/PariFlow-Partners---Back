import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FocusBoardCompletionMode,
  FocusBoardNoteKind,
  FocusBoardNotePriority,
  FocusBoardNoteStatus,
  FocusBoardNoteVisibility,
  FocusBoardParticipantRole,
  FocusBoardParticipantType
} from '@prisma/client';
import { AuthTokenPayload } from '../auth/interfaces/auth-token-payload.interface';
import { FocusBoardNotesService } from './focus-board-notes.service';

const fixedNow = new Date('2026-07-12T12:00:00.000Z');

function actor(
  overrides: Partial<AuthTokenPayload> = {}
): AuthTokenPayload {
  return {
    sub: 'usr_owner',
    firebaseUid: 'firebase-owner',
    email: 'owner@pariflow.test',
    tenantRootCompany: {
      publicId: 'ten_a',
      tradeName: 'Tenant A',
      legalName: 'Tenant A LTDA',
      cnpj: '00000000000100',
      status: 'ACTIVE'
    },
    profiles: ['ADMINISTRADOR'],
    audienceGroups: [],
    securityContext: 'privileged',
    capabilities: {
      canViewSensitive: true,
      canDownloadAttachments: true,
      canSoftDeleteAttachment: true
    },
    ...overrides
  };
}

function makeUser(publicId = 'usr_owner', id = 10n) {
  return {
    id,
    publicId,
    tenantRootCompanyId: 100n,
    firebaseUid: publicId,
    email: `${publicId}@pariflow.test`,
    name: publicId === 'usr_owner' ? 'Owner User' : 'Other User',
    status: 'ACTIVE',
    createdAt: fixedNow,
    updatedAt: fixedNow,
    firstAccessAt: fixedNow,
    lastAccessAt: fixedNow
  };
}

function makeNote(overrides: Record<string, unknown> = {}) {
  const owner = makeUser();
  return {
    id: 1n,
    publicId: 'fcn_note_1',
    tenantRootCompanyId: 100n,
    parentNoteId: null,
    threadRootNoteId: null,
    createdByUserSystemId: owner.id,
    ownerUserSystemId: owner.id,
    updatedByUserSystemId: null,
    clientMigrationId: null,
    kind: FocusBoardNoteKind.NOTE,
    title: 'Nota original',
    body: 'Corpo original',
    status: FocusBoardNoteStatus.ACTIVE,
    previousStatus: null,
    priority: FocusBoardNotePriority.NORMAL,
    visibility: FocusBoardNoteVisibility.PRIVATE,
    completionMode: FocusBoardCompletionMode.OWNER_ONLY,
    dueAt: new Date('2026-07-20T12:00:00.000Z'),
    completedAt: null,
    archivedAt: null,
    trashedAt: null,
    deletedAt: null,
    lastEditJustification: null,
    version: 3,
    createdAt: fixedNow,
    updatedAt: fixedNow,
    ownerUserSystem: owner,
    createdByUserSystem: owner,
    updatedByUserSystem: null,
    participants: [
      {
        id: 50n,
        publicId: 'fbp_owner',
        noteId: 1n,
        participantType: FocusBoardParticipantType.USER,
        userSystemId: owner.id,
        accessProfileId: null,
        audienceGroupKey: null,
        role: FocusBoardParticipantRole.OWNER,
        canComplete: true,
        requiredForCompletion: false,
        completedAt: null,
        completedByUserSystemId: null,
        createdByUserSystemId: owner.id,
        createdAt: fixedNow,
        userSystem: owner,
        accessProfile: null,
        completedByUserSystem: null
      }
    ],
    contexts: [],
    reminders: [],
    ...overrides
  };
}

function hasSubset(value: unknown, subset: unknown): boolean {
  if (matchesSubset(value, subset)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasSubset(item, subset));
  }

  if (value && typeof value === 'object') {
    return Object.values(value).some((item) => hasSubset(item, subset));
  }

  return false;
}

function matchesSubset(value: unknown, subset: unknown): boolean {
  if (!subset || typeof subset !== 'object') {
    return Object.is(value, subset);
  }

  if (!value || typeof value !== 'object') {
    return false;
  }

  return Object.entries(subset).every(([key, expected]) => {
    const actual = (value as Record<string, unknown>)[key];
    return matchesSubset(actual, expected);
  });
}

class FocusBoardPrismaMock {
  currentNote = makeNote();
  findManyResult = [this.currentNote];
  countResult = 1;
  countArgs: unknown[] = [];
  findManyArgs: unknown[] = [];
  findFirstArgs: unknown[] = [];
  updateArgs: Array<{ where: unknown; data: Record<string, unknown> }> = [];
  participantDeleteArgs: unknown[] = [];
  contextDeleteArgs: unknown[] = [];
  events: unknown[] = [];
  audits: unknown[] = [];

  assertConfigured() {}

  userSystem = {
    findUnique: async () => makeUser()
  };

  focusBoardNote = {
    count: async (args: unknown) => {
      this.countArgs.push(args);
      return this.countResult;
    },
    findMany: async (args: unknown) => {
      this.findManyArgs.push(args);
      return this.findManyResult;
    },
    findFirst: async (args: unknown) => {
      this.findFirstArgs.push(args);
      return this.currentNote;
    },
    update: async (args: { where: unknown; data: Record<string, unknown> }) => {
      this.updateArgs.push(args);
      this.currentNote = applyNoteUpdate(this.currentNote, args.data);
      return this.currentNote;
    }
  };

  focusBoardNoteParticipant = {
    deleteMany: async (args: unknown) => {
      this.participantDeleteArgs.push(args);
      return { count: 0 };
    }
  };

  focusBoardNoteContext = {
    deleteMany: async (args: unknown) => {
      this.contextDeleteArgs.push(args);
      return { count: 0 };
    }
  };

  focusBoardNoteEvent = {
    create: async (args: unknown) => {
      this.events.push(args);
      return args;
    },
    findMany: async () => []
  };

  auditLog = {
    create: async (args: unknown) => {
      this.audits.push(args);
      return args;
    }
  };

  $transaction = async <T>(callback: (tx: this) => Promise<T>) => callback(this);
}

function applyNoteUpdate(
  note: ReturnType<typeof makeNote>,
  data: Record<string, unknown>
) {
  const next = { ...note } as Record<string, unknown>;
  const directFields = [
    'title',
    'body',
    'priority',
    'visibility',
    'completionMode',
    'dueAt',
    'status',
    'previousStatus',
    'completedAt',
    'archivedAt',
    'trashedAt',
    'deletedAt',
    'lastEditJustification'
  ];

  for (const field of directFields) {
    if (Object.prototype.hasOwnProperty.call(data, field) && data[field] !== undefined) {
      next[field] = data[field];
    }
  }

  const version = data.version as { increment?: number } | undefined;
  if (version?.increment) {
    next.version = (next.version as number) + version.increment;
  }

  const updatedByUserSystem = data.updatedByUserSystem as
    | { connect?: { id?: bigint } }
    | undefined;
  if (updatedByUserSystem?.connect?.id) {
    next.updatedByUserSystemId = updatedByUserSystem.connect.id;
    next.updatedByUserSystem = makeUser('usr_owner', updatedByUserSystem.connect.id);
  }

  const uncheckedUpdatedBy = data.updatedByUserSystemId as bigint | undefined;
  if (uncheckedUpdatedBy) {
    next.updatedByUserSystemId = uncheckedUpdatedBy;
    next.updatedByUserSystem = makeUser('usr_owner', uncheckedUpdatedBy);
  }

  return next as ReturnType<typeof makeNote>;
}

describe('FocusBoardNotesService', () => {
  it('aplica tenant e ACL antes de listar notas', async () => {
    const prisma = new FocusBoardPrismaMock();
    const service = new FocusBoardNotesService(prisma as never);

    const result = await service.list({ limit: 10 } as never, actor());
    const countArgs = prisma.countArgs[0] as { where: unknown };

    assert.equal(result.items.length, 1);
    assert.equal(result.meta.authorizedTotal, 1);
    assert.ok(
      hasSubset(countArgs.where, {
        tenantRootCompany: { publicId: 'ten_a' }
      })
    );
    assert.ok(
      hasSubset(countArgs.where, {
        ownerUserSystem: { publicId: 'usr_owner' }
      })
    );
    assert.ok(
      hasSubset(countArgs.where, {
        participants: { some: { userSystem: { publicId: 'usr_owner' } } }
      })
    );
    assert.ok(
      hasSubset(countArgs.where, {
        status: FocusBoardNoteStatus.ACTIVE
      })
    );
  });

  it('PATCH preserva campos omitidos e troca apenas campos enviados', async () => {
    const prisma = new FocusBoardPrismaMock();
    const service = new FocusBoardNotesService(prisma as never);

    const result = await service.update(
      'fcn_note_1',
      { title: 'Nota atualizada', expectedVersion: 3 } as never,
      actor()
    );
    const updateData = prisma.updateArgs[0].data;

    assert.equal(result.title, 'Nota atualizada');
    assert.equal(updateData.title, 'Nota atualizada');
    assert.equal(updateData.body, undefined);
    assert.equal(updateData.dueAt, undefined);
    assert.equal(updateData.participants, undefined);
    assert.equal(updateData.contexts, undefined);
    assert.equal(prisma.participantDeleteArgs.length, 0);
    assert.equal(prisma.contextDeleteArgs.length, 0);
    assert.deepEqual(updateData.version, { increment: 1 });
    assert.equal(prisma.events.length, 1);
    assert.equal(prisma.audits.length, 1);
  });

  it('DELETE faz remocao logica e registra auditoria', async () => {
    const prisma = new FocusBoardPrismaMock();
    const service = new FocusBoardNotesService(prisma as never);

    const result = await service.remove(
      'fcn_note_1',
      { reason: 'Duplicidade operacional.', expectedVersion: 3 } as never,
      actor()
    );
    const updateData = prisma.updateArgs[0].data;
    const auditArgs = prisma.audits[0] as { data: { action: string } };
    const eventArgs = prisma.events[0] as {
      data: { eventType: FocusBoardNoteStatus };
    };

    assert.equal(result.status, FocusBoardNoteStatus.DELETED);
    assert.equal(updateData.status, FocusBoardNoteStatus.DELETED);
    assert.equal(updateData.previousStatus, FocusBoardNoteStatus.ACTIVE);
    assert.ok(updateData.deletedAt instanceof Date);
    assert.equal(auditArgs.data.action, 'delete');
    assert.equal(eventArgs.data.eventType, 'DELETED');
  });
});
