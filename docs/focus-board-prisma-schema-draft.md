# Focus Board - Draft de Schema Prisma

Data de referencia: `2026-07-12`.

Status: draft para implementacao. Este arquivo e documentacao; o schema real
continua em `prisma/schema.prisma`.

## Enums

```prisma
enum FocusBoardNoteKind {
  NOTE
  TASK
}

enum FocusBoardNoteVisibility {
  PRIVATE
  SHARED
}

enum FocusBoardNoteStatus {
  ACTIVE
  COMPLETED
  ARCHIVED
  TRASHED
  DELETED
}

enum FocusBoardNotePriority {
  LOW
  NORMAL
  IMPORTANT
  URGENT
}

enum FocusBoardParticipantType {
  USER
  ACCESS_PROFILE
  SENSITIVE_AUDIENCE_GROUP
}

enum FocusBoardParticipantRole {
  OWNER
  EDITOR
  VIEWER
  ASSIGNEE
}

enum FocusBoardCompletionMode {
  OWNER_ONLY
  FIRST_COMPLETES_ALL
  ALL_MUST_COMPLETE
}

enum FocusBoardContextType {
  PERSON
  PROVIDER_COMPANY
  CLIENT_COMPANY
  CONTRACT
  EMPLOYMENT_LINK
  POSITION
  TIMELINE_RECORD
  CALENDAR_ENTRY
  OTHER
}

enum FocusBoardNoteEventType {
  CREATED
  UPDATED
  VISIBILITY_CHANGED
  PARTICIPANT_ADDED
  PARTICIPANT_REMOVED
  CONTEXT_CHANGED
  COMPLETED
  REOPENED
  ARCHIVED
  TRASHED
  RESTORED
  DELETED
  REMINDER_LINKED
  REMINDER_CANCELED
}
```

## Modelos novos

```prisma
model FocusBoardNote {
  id                    BigInt                     @id @default(autoincrement())
  publicId              String                     @unique @db.VarChar(26)
  tenantRootCompanyId   BigInt?
  parentNoteId          BigInt?
  threadRootNoteId      BigInt?
  clientMigrationId     String?                    @db.VarChar(80)
  kind                  FocusBoardNoteKind         @default(NOTE)
  title                 String                     @db.VarChar(180)
  body                  String?                    @db.Text
  status                FocusBoardNoteStatus       @default(ACTIVE)
  previousStatus        FocusBoardNoteStatus?
  priority              FocusBoardNotePriority     @default(NORMAL)
  visibility            FocusBoardNoteVisibility   @default(PRIVATE)
  completionMode        FocusBoardCompletionMode   @default(OWNER_ONLY)
  dueAt                 DateTime?
  completedAt           DateTime?
  archivedAt            DateTime?
  trashedAt             DateTime?
  deletedAt             DateTime?
  createdByUserSystemId BigInt?
  ownerUserSystemId     BigInt
  updatedByUserSystemId BigInt?
  lastEditJustification String?                    @db.VarChar(180)
  version               Int                        @default(1)
  createdAt             DateTime                   @default(now())
  updatedAt             DateTime                   @updatedAt

  tenantRootCompany     TenantRootCompany?         @relation("FocusBoardNoteTenantRootCompany", fields: [tenantRootCompanyId], references: [id], onDelete: SetNull)
  parentNote            FocusBoardNote?            @relation("FocusBoardNoteReplies", fields: [parentNoteId], references: [id], onDelete: SetNull)
  replies               FocusBoardNote[]           @relation("FocusBoardNoteReplies")
  threadRootNote        FocusBoardNote?            @relation("FocusBoardNoteThreadRoot", fields: [threadRootNoteId], references: [id], onDelete: SetNull)
  threadNotes           FocusBoardNote[]           @relation("FocusBoardNoteThreadRoot")
  createdByUserSystem   UserSystem?                @relation("FocusBoardNoteCreatedBy", fields: [createdByUserSystemId], references: [id], onDelete: SetNull)
  ownerUserSystem       UserSystem                 @relation("FocusBoardNoteOwner", fields: [ownerUserSystemId], references: [id], onDelete: Restrict)
  updatedByUserSystem   UserSystem?                @relation("FocusBoardNoteUpdatedBy", fields: [updatedByUserSystemId], references: [id], onDelete: SetNull)
  participants          FocusBoardNoteParticipant[]
  contexts              FocusBoardNoteContext[]
  events                FocusBoardNoteEvent[]
  reminders             FocusBoardNoteReminder[]

  @@unique([tenantRootCompanyId, ownerUserSystemId, clientMigrationId])
  @@index([tenantRootCompanyId, ownerUserSystemId, status, updatedAt])
  @@index([tenantRootCompanyId, status, dueAt])
  @@index([tenantRootCompanyId, visibility, updatedAt])
  @@index([threadRootNoteId, createdAt])
  @@index([parentNoteId, createdAt])
  @@map("focus_board_note")
}

model FocusBoardNoteParticipant {
  id                        BigInt                    @id @default(autoincrement())
  publicId                  String                    @unique @db.VarChar(26)
  noteId                    BigInt
  participantType           FocusBoardParticipantType
  userSystemId              BigInt?
  accessProfileId           BigInt?
  audienceGroupKey          SensitiveAudienceGroup?
  role                      FocusBoardParticipantRole @default(VIEWER)
  canComplete               Boolean                   @default(false)
  requiredForCompletion     Boolean                   @default(false)
  completedAt               DateTime?
  completedByUserSystemId   BigInt?
  createdByUserSystemId     BigInt?
  createdAt                 DateTime                  @default(now())
  updatedAt                 DateTime                  @updatedAt

  note                      FocusBoardNote            @relation(fields: [noteId], references: [id], onDelete: Cascade)
  userSystem                UserSystem?               @relation("FocusBoardParticipantUser", fields: [userSystemId], references: [id], onDelete: Cascade)
  accessProfile             AccessProfile?            @relation("FocusBoardParticipantProfile", fields: [accessProfileId], references: [id], onDelete: Cascade)
  completedByUserSystem     UserSystem?               @relation("FocusBoardParticipantCompletedBy", fields: [completedByUserSystemId], references: [id], onDelete: SetNull)
  createdByUserSystem       UserSystem?               @relation("FocusBoardParticipantCreatedBy", fields: [createdByUserSystemId], references: [id], onDelete: SetNull)

  @@index([noteId, role])
  @@index([userSystemId])
  @@index([accessProfileId])
  @@index([audienceGroupKey])
  @@map("focus_board_note_participant")
}

model FocusBoardNoteContext {
  id                    BigInt                @id @default(autoincrement())
  publicId              String                @unique @db.VarChar(26)
  noteId                BigInt
  contextType           FocusBoardContextType
  personId              BigInt?
  providerCompanyId     BigInt?
  clientCompanyId       BigInt?
  contractId            BigInt?
  employmentLinkId      BigInt?
  positionId            BigInt?
  timelineRecordId      BigInt?
  calendarEntryId       BigInt?
  externalLabel         String?               @db.VarChar(180)
  labelSnapshot         String                @db.VarChar(180)
  createdAt             DateTime              @default(now())

  note                  FocusBoardNote        @relation(fields: [noteId], references: [id], onDelete: Cascade)
  person                Person?               @relation(fields: [personId], references: [id], onDelete: SetNull)
  providerCompany       ProviderCompany?      @relation(fields: [providerCompanyId], references: [id], onDelete: SetNull)
  clientCompany         ClientCompany?        @relation(fields: [clientCompanyId], references: [id], onDelete: SetNull)
  contract              Contract?             @relation(fields: [contractId], references: [id], onDelete: SetNull)
  employmentLink        EmploymentLink?       @relation(fields: [employmentLinkId], references: [id], onDelete: SetNull)
  position              Position?             @relation(fields: [positionId], references: [id], onDelete: SetNull)
  timelineRecord        TimelineRecord?       @relation(fields: [timelineRecordId], references: [id], onDelete: SetNull)
  calendarEntry         CalendarEntry?        @relation(fields: [calendarEntryId], references: [id], onDelete: SetNull)

  @@index([noteId])
  @@index([contextType])
  @@index([personId])
  @@index([providerCompanyId])
  @@index([clientCompanyId])
  @@index([contractId])
  @@index([employmentLinkId])
  @@index([positionId])
  @@index([timelineRecordId])
  @@index([calendarEntryId])
  @@map("focus_board_note_context")
}

model FocusBoardNoteEvent {
  id                  BigInt                  @id @default(autoincrement())
  publicId            String                  @unique @db.VarChar(26)
  tenantRootCompanyId BigInt?
  noteId              BigInt
  actorUserSystemId   BigInt?
  eventType           FocusBoardNoteEventType
  summary             String                  @db.VarChar(255)
  beforeJson          Json?
  afterJson           Json?
  ipAddress           String?                 @db.VarChar(64)
  device              String?                 @db.VarChar(255)
  createdAt           DateTime                @default(now())

  tenantRootCompany   TenantRootCompany?      @relation("FocusBoardEventTenantRootCompany", fields: [tenantRootCompanyId], references: [id], onDelete: SetNull)
  note                FocusBoardNote          @relation(fields: [noteId], references: [id], onDelete: Cascade)
  actorUserSystem     UserSystem?             @relation("FocusBoardEventActor", fields: [actorUserSystemId], references: [id], onDelete: SetNull)

  @@index([tenantRootCompanyId, createdAt])
  @@index([noteId, createdAt])
  @@index([actorUserSystemId, createdAt])
  @@map("focus_board_note_event")
}

model FocusBoardNoteReminder {
  id                    BigInt           @id @default(autoincrement())
  publicId              String           @unique @db.VarChar(26)
  noteId                BigInt
  calendarEntryId       BigInt
  createdByUserSystemId BigInt?
  createdAt             DateTime         @default(now())

  note                  FocusBoardNote   @relation(fields: [noteId], references: [id], onDelete: Cascade)
  calendarEntry         CalendarEntry    @relation(fields: [calendarEntryId], references: [id], onDelete: Cascade)
  createdByUserSystem   UserSystem?      @relation("FocusBoardReminderCreatedBy", fields: [createdByUserSystemId], references: [id], onDelete: SetNull)

  @@unique([noteId, calendarEntryId])
  @@index([calendarEntryId])
  @@map("focus_board_note_reminder")
}
```

## Relacoes a adicionar em modelos existentes

Adicionar arrays com nomes de relacao correspondentes em:

- `TenantRootCompany`
- `UserSystem`
- `AccessProfile`
- `Person`
- `ProviderCompany`
- `ClientCompany`
- `Contract`
- `EmploymentLink`
- `Position`
- `TimelineRecord`
- `CalendarEntry`

## Regras que Prisma nao garante sozinho

Validar no service:

- participante deve apontar exatamente um alvo: usuario, perfil ou grupo;
- contexto deve apontar exatamente uma entidade, exceto `OTHER`;
- owner deve existir como participante `OWNER`;
- `clientMigrationId` so pode ser usado por owner autenticado;
- `visibility=PRIVATE` nao pode conceder leitura ampla por perfil/grupo;
- `contexts` nao concedem ACL automaticamente;
- status `DELETED` nao volta para ativo.

## Observacao sobre unicidade nullable

`clientMigrationId` e opcional. MySQL permite multiplos `NULL` em unique
composta. Quando preenchido, o service deve tratar conflito como idempotencia e
comparar payload essencial antes de retornar a nota existente.
