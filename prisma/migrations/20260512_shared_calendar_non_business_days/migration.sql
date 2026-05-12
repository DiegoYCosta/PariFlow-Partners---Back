-- AlterTable
ALTER TABLE `agenda_item`
    MODIFY `kind` ENUM('REMINDER', 'APPOINTMENT', 'NOTICE') NOT NULL,
    ADD COLUMN `category` VARCHAR(80) NULL AFTER `targetType`,
    ADD COLUMN `recurrenceRule` VARCHAR(80) NULL AFTER `category`,
    ADD COLUMN `audienceJson` JSON NULL AFTER `recurrenceRule`;

-- CreateTable
CREATE TABLE `agenda_dia_nao_util` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `tenantRootCompanyId` BIGINT NULL,
    `date` DATETIME(3) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `scope` VARCHAR(40) NOT NULL DEFAULT 'CUSTOM',
    `regionCode` VARCHAR(40) NULL,
    `cityName` VARCHAR(120) NULL,
    `isRecurringYearly` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `createdByUserSystemId` BIGINT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `agenda_dia_nao_util_publicId_key`(`publicId`),
    INDEX `agenda_dia_nao_util_tenantRootCompanyId_date_active_idx`(`tenantRootCompanyId`, `date`, `active`),
    INDEX `agenda_dia_nao_util_tenantRootCompanyId_regionCode_active_idx`(`tenantRootCompanyId`, `regionCode`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `agenda_dia_nao_util`
    ADD CONSTRAINT `agenda_dia_nao_util_tenantRootCompanyId_fkey`
    FOREIGN KEY (`tenantRootCompanyId`) REFERENCES `empresa_raiz_cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `agenda_dia_nao_util`
    ADD CONSTRAINT `agenda_dia_nao_util_createdByUserSystemId_fkey`
    FOREIGN KEY (`createdByUserSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
