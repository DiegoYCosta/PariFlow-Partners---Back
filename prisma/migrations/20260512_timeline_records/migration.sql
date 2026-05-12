-- CreateTable
CREATE TABLE `timeline_record` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `tenantRootCompanyId` BIGINT NULL,
    `title` VARCHAR(180) NOT NULL,
    `description` TEXT NOT NULL,
    `category` VARCHAR(80) NOT NULL,
    `nature` ENUM('POSITIVE', 'NEUTRAL', 'NEGATIVE') NOT NULL DEFAULT 'NEUTRAL',
    `referenceMonth` DATETIME(3) NOT NULL,
    `eventDate` DATETIME(3) NULL,
    `visibility` ENUM('INTERNAL', 'SENSITIVE', 'CRITICAL') NOT NULL DEFAULT 'INTERNAL',
    `status` VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    `createdByUserSystemPublicId` VARCHAR(26) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `timeline_record_publicId_key`(`publicId`),
    INDEX `timeline_record_tenantRootCompanyId_referenceMonth_idx`(`tenantRootCompanyId`, `referenceMonth`),
    INDEX `timeline_record_tenantRootCompanyId_eventDate_idx`(`tenantRootCompanyId`, `eventDate`),
    INDEX `timeline_record_tenantRootCompanyId_category_idx`(`tenantRootCompanyId`, `category`),
    INDEX `timeline_record_tenantRootCompanyId_status_idx`(`tenantRootCompanyId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `timeline_record_link` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `recordId` BIGINT NOT NULL,
    `entityType` VARCHAR(60) NOT NULL,
    `entityPublicId` VARCHAR(26) NULL,
    `labelSnapshot` VARCHAR(180) NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `timeline_record_link_publicId_key`(`publicId`),
    INDEX `timeline_record_link_recordId_idx`(`recordId`),
    INDEX `timeline_record_link_entityType_entityPublicId_idx`(`entityType`, `entityPublicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `timeline_record`
    ADD CONSTRAINT `timeline_record_tenantRootCompanyId_fkey`
    FOREIGN KEY (`tenantRootCompanyId`) REFERENCES `empresa_raiz_cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timeline_record_link`
    ADD CONSTRAINT `timeline_record_link_recordId_fkey`
    FOREIGN KEY (`recordId`) REFERENCES `timeline_record`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
