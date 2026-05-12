-- CreateTable
CREATE TABLE `cliente_onboarding_cnpj_registry` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `cnpj` VARCHAR(14) NOT NULL,
    `status` ENUM('AVAILABLE', 'AVAILABLE_FOR_TEST', 'IN_USE', 'UNAVAILABLE') NOT NULL,
    `commercialContactName` VARCHAR(160) NOT NULL,
    `commercialContactEmail` VARCHAR(180) NULL,
    `commercialContactPhone` VARCHAR(30) NULL,
    `note` VARCHAR(255) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cliente_onboarding_cnpj_registry_publicId_key`(`publicId`),
    UNIQUE INDEX `cliente_onboarding_cnpj_registry_cnpj_key`(`cnpj`),
    INDEX `cjr_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cliente_onboarding_verificacao` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `cnpjRegistryId` BIGINT NOT NULL,
    `channel` ENUM('EMAIL', 'PHONE', 'NONE') NOT NULL,
    `target` VARCHAR(180) NOT NULL,
    `codeHash` VARCHAR(128) NOT NULL,
    `status` ENUM('PENDING', 'VERIFIED', 'EXPIRED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 5,
    `expiresAt` DATETIME(3) NOT NULL,
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cliente_onboarding_verificacao_publicId_key`(`publicId`),
    INDEX `cov_registry_status_exp_idx`(`cnpjRegistryId`, `status`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_outbox` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `tenantRootCompanyId` BIGINT NULL,
    `channel` ENUM('EMAIL', 'SMS', 'WHATSAPP') NOT NULL,
    `target` VARCHAR(180) NOT NULL,
    `subject` VARCHAR(180) NULL,
    `message` TEXT NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `metadataJson` JSON NULL,
    `queuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastAttemptAt` DATETIME(3) NULL,
    `nextAttemptAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `failedAt` DATETIME(3) NULL,
    `failureReason` VARCHAR(255) NULL,

    UNIQUE INDEX `notification_outbox_publicId_key`(`publicId`),
    INDEX `notification_outbox_status_queuedAt_idx`(`status`, `queuedAt`),
    INDEX `notification_outbox_tenantRootCompanyId_queuedAt_idx`(`tenantRootCompanyId`, `queuedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `cliente_onboarding_solicitacao`
    ADD COLUMN `verificationChallengeId` BIGINT NULL AFTER `tenantRootCompanyId`;

-- CreateIndex
CREATE INDEX `cos_verificationChallengeId_idx`
    ON `cliente_onboarding_solicitacao`(`verificationChallengeId`);

-- AddForeignKey
ALTER TABLE `cliente_onboarding_verificacao`
    ADD CONSTRAINT `cliente_onboarding_verificacao_cnpjRegistryId_fkey`
    FOREIGN KEY (`cnpjRegistryId`) REFERENCES `cliente_onboarding_cnpj_registry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `cliente_onboarding_solicitacao`
    ADD CONSTRAINT `cliente_onboarding_solicitacao_verificationChallengeId_fkey`
    FOREIGN KEY (`verificationChallengeId`) REFERENCES `cliente_onboarding_verificacao`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `notification_outbox`
    ADD CONSTRAINT `notification_outbox_tenantRootCompanyId_fkey`
    FOREIGN KEY (`tenantRootCompanyId`) REFERENCES `empresa_raiz_cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
