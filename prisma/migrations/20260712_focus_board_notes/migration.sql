-- CreateTable
CREATE TABLE `focus_board_note` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `tenantRootCompanyId` BIGINT NULL,
    `parentNoteId` BIGINT NULL,
    `threadRootNoteId` BIGINT NULL,
    `clientMigrationId` VARCHAR(80) NULL,
    `kind` ENUM('NOTE', 'TASK') NOT NULL DEFAULT 'NOTE',
    `title` VARCHAR(180) NOT NULL,
    `body` TEXT NULL,
    `status` ENUM('ACTIVE', 'COMPLETED', 'ARCHIVED', 'TRASHED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
    `previousStatus` ENUM('ACTIVE', 'COMPLETED', 'ARCHIVED', 'TRASHED', 'DELETED') NULL,
    `priority` ENUM('LOW', 'NORMAL', 'IMPORTANT', 'URGENT') NOT NULL DEFAULT 'NORMAL',
    `visibility` ENUM('PRIVATE', 'SHARED') NOT NULL DEFAULT 'PRIVATE',
    `completionMode` ENUM('OWNER_ONLY', 'FIRST_COMPLETES_ALL', 'ALL_MUST_COMPLETE') NOT NULL DEFAULT 'OWNER_ONLY',
    `dueAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `archivedAt` DATETIME(3) NULL,
    `trashedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdByUserSystemId` BIGINT NULL,
    `ownerUserSystemId` BIGINT NOT NULL,
    `updatedByUserSystemId` BIGINT NULL,
    `lastEditJustification` VARCHAR(180) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `focus_board_note_publicId_key`(`publicId`),
    UNIQUE INDEX `fb_note_migration_owner_uq`(`tenantRootCompanyId`, `ownerUserSystemId`, `clientMigrationId`),
    INDEX `fb_note_owner_status_idx`(`tenantRootCompanyId`, `ownerUserSystemId`, `status`, `updatedAt`),
    INDEX `fb_note_status_due_idx`(`tenantRootCompanyId`, `status`, `dueAt`),
    INDEX `fb_note_visibility_idx`(`tenantRootCompanyId`, `visibility`, `updatedAt`),
    INDEX `fb_note_thread_idx`(`threadRootNoteId`, `createdAt`),
    INDEX `fb_note_parent_idx`(`parentNoteId`, `createdAt`),
    INDEX `focus_board_note_createdByUserSystemId_idx`(`createdByUserSystemId`),
    INDEX `focus_board_note_updatedByUserSystemId_idx`(`updatedByUserSystemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `focus_board_note_participant` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `noteId` BIGINT NOT NULL,
    `participantType` ENUM('USER', 'ACCESS_PROFILE', 'SENSITIVE_AUDIENCE_GROUP') NOT NULL,
    `userSystemId` BIGINT NULL,
    `accessProfileId` BIGINT NULL,
    `audienceGroupKey` ENUM('DIRECTOR', 'SUPERVISION', 'AUXILIARY') NULL,
    `role` ENUM('OWNER', 'EDITOR', 'VIEWER', 'ASSIGNEE') NOT NULL DEFAULT 'VIEWER',
    `canComplete` BOOLEAN NOT NULL DEFAULT false,
    `requiredForCompletion` BOOLEAN NOT NULL DEFAULT false,
    `completedAt` DATETIME(3) NULL,
    `completedByUserSystemId` BIGINT NULL,
    `createdByUserSystemId` BIGINT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `focus_board_note_participant_publicId_key`(`publicId`),
    INDEX `fb_participant_note_role_idx`(`noteId`, `role`),
    INDEX `fb_participant_user_idx`(`userSystemId`),
    INDEX `fb_participant_profile_idx`(`accessProfileId`),
    INDEX `fb_participant_group_idx`(`audienceGroupKey`),
    INDEX `focus_board_note_participant_completedByUserSystemId_idx`(`completedByUserSystemId`),
    INDEX `focus_board_note_participant_createdByUserSystemId_idx`(`createdByUserSystemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `focus_board_note_context` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `noteId` BIGINT NOT NULL,
    `contextType` ENUM('PERSON', 'PROVIDER_COMPANY', 'CLIENT_COMPANY', 'CONTRACT', 'EMPLOYMENT_LINK', 'POSITION', 'TIMELINE_RECORD', 'CALENDAR_ENTRY', 'OTHER') NOT NULL,
    `personId` BIGINT NULL,
    `providerCompanyId` BIGINT NULL,
    `clientCompanyId` BIGINT NULL,
    `contractId` BIGINT NULL,
    `employmentLinkId` BIGINT NULL,
    `positionId` BIGINT NULL,
    `timelineRecordId` BIGINT NULL,
    `calendarEntryId` BIGINT NULL,
    `externalLabel` VARCHAR(180) NULL,
    `labelSnapshot` VARCHAR(180) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `focus_board_note_context_publicId_key`(`publicId`),
    INDEX `fb_context_note_idx`(`noteId`),
    INDEX `fb_context_type_idx`(`contextType`),
    INDEX `fb_context_person_idx`(`personId`),
    INDEX `fb_context_provider_idx`(`providerCompanyId`),
    INDEX `fb_context_client_idx`(`clientCompanyId`),
    INDEX `fb_context_contract_idx`(`contractId`),
    INDEX `fb_context_link_idx`(`employmentLinkId`),
    INDEX `fb_context_position_idx`(`positionId`),
    INDEX `fb_context_timeline_idx`(`timelineRecordId`),
    INDEX `fb_context_calendar_idx`(`calendarEntryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `focus_board_note_event` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `tenantRootCompanyId` BIGINT NULL,
    `noteId` BIGINT NOT NULL,
    `actorUserSystemId` BIGINT NULL,
    `eventType` ENUM('CREATED', 'UPDATED', 'VISIBILITY_CHANGED', 'PARTICIPANT_ADDED', 'PARTICIPANT_REMOVED', 'CONTEXT_CHANGED', 'COMPLETED', 'REOPENED', 'ARCHIVED', 'TRASHED', 'RESTORED', 'DELETED', 'REMINDER_LINKED', 'REMINDER_CANCELED') NOT NULL,
    `summary` VARCHAR(255) NOT NULL,
    `beforeJson` JSON NULL,
    `afterJson` JSON NULL,
    `ipAddress` VARCHAR(64) NULL,
    `device` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `focus_board_note_event_publicId_key`(`publicId`),
    INDEX `fb_event_tenant_created_idx`(`tenantRootCompanyId`, `createdAt`),
    INDEX `fb_event_note_created_idx`(`noteId`, `createdAt`),
    INDEX `fb_event_actor_created_idx`(`actorUserSystemId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `focus_board_note_reminder` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `noteId` BIGINT NOT NULL,
    `calendarEntryId` BIGINT NOT NULL,
    `createdByUserSystemId` BIGINT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `focus_board_note_reminder_publicId_key`(`publicId`),
    UNIQUE INDEX `fb_reminder_note_calendar_uq`(`noteId`, `calendarEntryId`),
    INDEX `fb_reminder_calendar_idx`(`calendarEntryId`),
    INDEX `focus_board_note_reminder_createdByUserSystemId_idx`(`createdByUserSystemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `focus_board_note`
    ADD CONSTRAINT `focus_board_note_tenantRootCompanyId_fkey`
    FOREIGN KEY (`tenantRootCompanyId`) REFERENCES `empresa_raiz_cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note`
    ADD CONSTRAINT `focus_board_note_parentNoteId_fkey`
    FOREIGN KEY (`parentNoteId`) REFERENCES `focus_board_note`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note`
    ADD CONSTRAINT `focus_board_note_threadRootNoteId_fkey`
    FOREIGN KEY (`threadRootNoteId`) REFERENCES `focus_board_note`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note`
    ADD CONSTRAINT `focus_board_note_createdByUserSystemId_fkey`
    FOREIGN KEY (`createdByUserSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note`
    ADD CONSTRAINT `focus_board_note_ownerUserSystemId_fkey`
    FOREIGN KEY (`ownerUserSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note`
    ADD CONSTRAINT `focus_board_note_updatedByUserSystemId_fkey`
    FOREIGN KEY (`updatedByUserSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note_participant`
    ADD CONSTRAINT `focus_board_note_participant_noteId_fkey`
    FOREIGN KEY (`noteId`) REFERENCES `focus_board_note`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note_participant`
    ADD CONSTRAINT `focus_board_note_participant_userSystemId_fkey`
    FOREIGN KEY (`userSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note_participant`
    ADD CONSTRAINT `focus_board_note_participant_accessProfileId_fkey`
    FOREIGN KEY (`accessProfileId`) REFERENCES `perfil_acesso`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note_participant`
    ADD CONSTRAINT `focus_board_note_participant_completedByUserSystemId_fkey`
    FOREIGN KEY (`completedByUserSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note_participant`
    ADD CONSTRAINT `focus_board_note_participant_createdByUserSystemId_fkey`
    FOREIGN KEY (`createdByUserSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note_context`
    ADD CONSTRAINT `focus_board_note_context_noteId_fkey`
    FOREIGN KEY (`noteId`) REFERENCES `focus_board_note`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note_context`
    ADD CONSTRAINT `focus_board_note_context_personId_fkey`
    FOREIGN KEY (`personId`) REFERENCES `pessoa`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note_context`
    ADD CONSTRAINT `focus_board_note_context_providerCompanyId_fkey`
    FOREIGN KEY (`providerCompanyId`) REFERENCES `empresa_prestadora`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note_context`
    ADD CONSTRAINT `focus_board_note_context_clientCompanyId_fkey`
    FOREIGN KEY (`clientCompanyId`) REFERENCES `cliente_contratante`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note_context`
    ADD CONSTRAINT `focus_board_note_context_contractId_fkey`
    FOREIGN KEY (`contractId`) REFERENCES `contrato`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note_context`
    ADD CONSTRAINT `focus_board_note_context_employmentLinkId_fkey`
    FOREIGN KEY (`employmentLinkId`) REFERENCES `vinculo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note_context`
    ADD CONSTRAINT `focus_board_note_context_positionId_fkey`
    FOREIGN KEY (`positionId`) REFERENCES `posto_ou_vaga`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note_context`
    ADD CONSTRAINT `focus_board_note_context_timelineRecordId_fkey`
    FOREIGN KEY (`timelineRecordId`) REFERENCES `timeline_record`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note_context`
    ADD CONSTRAINT `focus_board_note_context_calendarEntryId_fkey`
    FOREIGN KEY (`calendarEntryId`) REFERENCES `agenda_item`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note_event`
    ADD CONSTRAINT `focus_board_note_event_tenantRootCompanyId_fkey`
    FOREIGN KEY (`tenantRootCompanyId`) REFERENCES `empresa_raiz_cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note_event`
    ADD CONSTRAINT `focus_board_note_event_noteId_fkey`
    FOREIGN KEY (`noteId`) REFERENCES `focus_board_note`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note_event`
    ADD CONSTRAINT `focus_board_note_event_actorUserSystemId_fkey`
    FOREIGN KEY (`actorUserSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note_reminder`
    ADD CONSTRAINT `focus_board_note_reminder_noteId_fkey`
    FOREIGN KEY (`noteId`) REFERENCES `focus_board_note`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note_reminder`
    ADD CONSTRAINT `focus_board_note_reminder_calendarEntryId_fkey`
    FOREIGN KEY (`calendarEntryId`) REFERENCES `agenda_item`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `focus_board_note_reminder`
    ADD CONSTRAINT `focus_board_note_reminder_createdByUserSystemId_fkey`
    FOREIGN KEY (`createdByUserSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
