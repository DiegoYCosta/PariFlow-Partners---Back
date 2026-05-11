-- AlterTable
ALTER TABLE `usuario_sistema`
    ADD COLUMN `providerCompanyId` BIGINT NULL AFTER `firebaseUid`,
    ADD COLUMN `clientCompanyId` BIGINT NULL AFTER `providerCompanyId`;

CREATE INDEX `usuario_sistema_providerCompanyId_idx` ON `usuario_sistema`(`providerCompanyId`);
CREATE INDEX `usuario_sistema_clientCompanyId_idx` ON `usuario_sistema`(`clientCompanyId`);

-- CreateTable
CREATE TABLE `agenda_item` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `kind` ENUM('REMINDER', 'APPOINTMENT') NOT NULL,
    `status` ENUM('SCHEDULED', 'COMPLETED', 'CANCELED', 'MISSED') NOT NULL DEFAULT 'SCHEDULED',
    `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'NORMAL',
    `targetType` ENUM('GENERAL', 'PERSON', 'PROVIDER_COMPANY', 'CLIENT_COMPANY', 'CONTRACT', 'EMPLOYMENT_LINK', 'POSITION') NOT NULL DEFAULT 'GENERAL',
    `title` VARCHAR(180) NOT NULL,
    `description` TEXT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NULL,
    `timezone` VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
    `isAllDay` BOOLEAN NOT NULL DEFAULT false,
    `businessDayPolicy` ENUM('ALLOW_NON_BUSINESS_DAY', 'REQUIRE_BUSINESS_DAY', 'MOVE_TO_PREVIOUS_BUSINESS_DAY', 'MOVE_TO_NEXT_BUSINESS_DAY') NOT NULL DEFAULT 'ALLOW_NON_BUSINESS_DAY',
    `holidayRegionCode` VARCHAR(40) NULL,
    `personId` BIGINT NULL,
    `providerCompanyId` BIGINT NULL,
    `clientCompanyId` BIGINT NULL,
    `contractId` BIGINT NULL,
    `employmentLinkId` BIGINT NULL,
    `positionId` BIGINT NULL,
    `createdByUserSystemId` BIGINT NULL,
    `assignedToUserSystemId` BIGINT NULL,
    `completedAt` DATETIME(3) NULL,
    `canceledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `agenda_item_publicId_key`(`publicId`),
    INDEX `agenda_item_startsAt_status_idx`(`startsAt`, `status`),
    INDEX `agenda_item_kind_startsAt_idx`(`kind`, `startsAt`),
    INDEX `agenda_item_personId_startsAt_idx`(`personId`, `startsAt`),
    INDEX `agenda_item_providerCompanyId_startsAt_idx`(`providerCompanyId`, `startsAt`),
    INDEX `agenda_item_clientCompanyId_startsAt_idx`(`clientCompanyId`, `startsAt`),
    INDEX `agenda_item_contractId_startsAt_idx`(`contractId`, `startsAt`),
    INDEX `agenda_item_employmentLinkId_startsAt_idx`(`employmentLinkId`, `startsAt`),
    INDEX `agenda_item_positionId_startsAt_idx`(`positionId`, `startsAt`),
    INDEX `agenda_item_createdByUserSystemId_startsAt_idx`(`createdByUserSystemId`, `startsAt`),
    INDEX `agenda_item_assignedToUserSystemId_startsAt_idx`(`assignedToUserSystemId`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `usuario_sistema`
    ADD CONSTRAINT `usuario_sistema_providerCompanyId_fkey`
    FOREIGN KEY (`providerCompanyId`) REFERENCES `empresa_prestadora`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuario_sistema`
    ADD CONSTRAINT `usuario_sistema_clientCompanyId_fkey`
    FOREIGN KEY (`clientCompanyId`) REFERENCES `cliente_contratante`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agenda_item`
    ADD CONSTRAINT `agenda_item_personId_fkey`
    FOREIGN KEY (`personId`) REFERENCES `pessoa`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agenda_item`
    ADD CONSTRAINT `agenda_item_providerCompanyId_fkey`
    FOREIGN KEY (`providerCompanyId`) REFERENCES `empresa_prestadora`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agenda_item`
    ADD CONSTRAINT `agenda_item_clientCompanyId_fkey`
    FOREIGN KEY (`clientCompanyId`) REFERENCES `cliente_contratante`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agenda_item`
    ADD CONSTRAINT `agenda_item_contractId_fkey`
    FOREIGN KEY (`contractId`) REFERENCES `contrato`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agenda_item`
    ADD CONSTRAINT `agenda_item_employmentLinkId_fkey`
    FOREIGN KEY (`employmentLinkId`) REFERENCES `vinculo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agenda_item`
    ADD CONSTRAINT `agenda_item_positionId_fkey`
    FOREIGN KEY (`positionId`) REFERENCES `posto_ou_vaga`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agenda_item`
    ADD CONSTRAINT `agenda_item_createdByUserSystemId_fkey`
    FOREIGN KEY (`createdByUserSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agenda_item`
    ADD CONSTRAINT `agenda_item_assignedToUserSystemId_fkey`
    FOREIGN KEY (`assignedToUserSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
