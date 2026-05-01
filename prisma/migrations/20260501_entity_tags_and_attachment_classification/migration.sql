-- AlterTable
ALTER TABLE `anexo`
    ADD COLUMN `classification` ENUM('FORMAL_DOCUMENT', 'SENSITIVE_ATTACHMENT', 'SUPPORTING_REFERENCE') NOT NULL DEFAULT 'FORMAL_DOCUMENT' AFTER `displayScope`;

-- CreateTable
CREATE TABLE `tag_entidade` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `targetType` ENUM('PERSON', 'PROVIDER_COMPANY') NOT NULL,
    `personId` BIGINT NULL,
    `providerCompanyId` BIGINT NULL,
    `classification` ENUM('BEHAVIORAL_SIGNAL', 'ROUTINE_CONTEXT', 'FAMILY_CONTEXT', 'TRAINING_OR_SKILL', 'PERSONAL_CONTEXT', 'OPERATIONAL_RISK') NOT NULL,
    `status` ENUM('ACTIVE', 'REMOVED') NOT NULL DEFAULT 'ACTIVE',
    `label` VARCHAR(80) NOT NULL,
    `content` VARCHAR(350) NOT NULL,
    `color` VARCHAR(32) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isAnonymousSubmission` BOOLEAN NOT NULL DEFAULT true,
    `createdByUserSystemId` BIGINT NULL,
    `removedByUserSystemId` BIGINT NULL,
    `removedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tag_entidade_publicId_key`(`publicId`),
    INDEX `tag_entidade_targetType_status_sortOrder_idx`(`targetType`, `status`, `sortOrder`),
    INDEX `tag_entidade_personId_status_idx`(`personId`, `status`),
    INDEX `tag_entidade_providerCompanyId_status_idx`(`providerCompanyId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tag_entidade`
    ADD CONSTRAINT `tag_entidade_personId_fkey`
    FOREIGN KEY (`personId`) REFERENCES `pessoa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tag_entidade`
    ADD CONSTRAINT `tag_entidade_providerCompanyId_fkey`
    FOREIGN KEY (`providerCompanyId`) REFERENCES `empresa_prestadora`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tag_entidade`
    ADD CONSTRAINT `tag_entidade_createdByUserSystemId_fkey`
    FOREIGN KEY (`createdByUserSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tag_entidade`
    ADD CONSTRAINT `tag_entidade_removedByUserSystemId_fkey`
    FOREIGN KEY (`removedByUserSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
