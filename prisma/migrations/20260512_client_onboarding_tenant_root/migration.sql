-- CreateTable
CREATE TABLE `empresa_raiz_cliente` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `tradeName` VARCHAR(180) NOT NULL,
    `legalName` VARCHAR(180) NOT NULL,
    `cnpj` VARCHAR(14) NOT NULL,
    `stateRegistration` VARCHAR(40) NULL,
    `municipalRegistration` VARCHAR(40) NULL,
    `companyType` VARCHAR(80) NOT NULL,
    `segment` VARCHAR(180) NOT NULL,
    `primaryCnae` VARCHAR(16) NULL,
    `companySize` VARCHAR(50) NOT NULL,
    `contractType` ENUM('ACTIVE_CLIENT', 'DEMO_ACCESS', 'UNAVAILABLE') NOT NULL,
    `status` ENUM('PENDING_REVIEW', 'PENDING_VERIFICATION', 'ACTIVE', 'DEMO', 'UNAVAILABLE') NOT NULL DEFAULT 'PENDING_VERIFICATION',
    `isRootCompany` BOOLEAN NOT NULL DEFAULT true,
    `deletionLocked` BOOLEAN NOT NULL DEFAULT true,
    `primaryContactName` VARCHAR(160) NOT NULL,
    `primaryContactEmail` VARCHAR(180) NULL,
    `primaryContactPhone` VARCHAR(30) NULL,
    `accountQuotasJson` JSON NULL,
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `empresa_raiz_cliente_publicId_key`(`publicId`),
    UNIQUE INDEX `empresa_raiz_cliente_cnpj_key`(`cnpj`),
    INDEX `empresa_raiz_cliente_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cliente_onboarding_solicitacao` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `tenantRootCompanyId` BIGINT NULL,
    `cnpj` VARCHAR(14) NOT NULL,
    `tradeName` VARCHAR(180) NOT NULL,
    `legalName` VARCHAR(180) NOT NULL,
    `stateRegistration` VARCHAR(40) NULL,
    `municipalRegistration` VARCHAR(40) NULL,
    `companyType` VARCHAR(80) NOT NULL,
    `segment` VARCHAR(180) NOT NULL,
    `primaryCnae` VARCHAR(16) NULL,
    `companySize` VARCHAR(50) NOT NULL,
    `cnpjStatus` ENUM('AVAILABLE', 'AVAILABLE_FOR_TEST', 'IN_USE', 'UNAVAILABLE') NOT NULL,
    `contractType` ENUM('ACTIVE_CLIENT', 'DEMO_ACCESS', 'UNAVAILABLE') NOT NULL,
    `status` ENUM('PENDING_REVIEW', 'PENDING_VERIFICATION', 'RELEASED', 'REJECTED', 'UNAVAILABLE') NOT NULL DEFAULT 'PENDING_VERIFICATION',
    `primaryContactName` VARCHAR(160) NOT NULL,
    `primaryContactEmail` VARCHAR(180) NULL,
    `primaryContactPhone` VARCHAR(30) NULL,
    `accountQuotasJson` JSON NULL,
    `verificationAccepted` BOOLEAN NOT NULL DEFAULT false,
    `verificationChannel` ENUM('EMAIL', 'PHONE', 'NONE') NOT NULL DEFAULT 'NONE',
    `verificationTarget` VARCHAR(180) NULL,
    `verificationMatchedRegistry` BOOLEAN NOT NULL DEFAULT false,
    `reviewNotificationEmail` VARCHAR(180) NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `releasedAt` DATETIME(3) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cliente_onboarding_solicitacao_publicId_key`(`publicId`),
    INDEX `cliente_onboarding_solicitacao_cnpj_submittedAt_idx`(`cnpj`, `submittedAt`),
    INDEX `cliente_onboarding_solicitacao_status_submittedAt_idx`(`status`, `submittedAt`),
    INDEX `cliente_onboarding_solicitacao_tenantRootCompanyId_idx`(`tenantRootCompanyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `usuario_sistema`
    ADD COLUMN `tenantRootCompanyId` BIGINT NULL AFTER `firebaseUid`;

ALTER TABLE `empresa_prestadora`
    ADD COLUMN `tenantRootCompanyId` BIGINT NULL AFTER `publicId`;

ALTER TABLE `cliente_contratante`
    ADD COLUMN `tenantRootCompanyId` BIGINT NULL AFTER `publicId`;

ALTER TABLE `contrato`
    ADD COLUMN `tenantRootCompanyId` BIGINT NULL AFTER `publicId`;

ALTER TABLE `posto_ou_vaga`
    ADD COLUMN `tenantRootCompanyId` BIGINT NULL AFTER `publicId`;

ALTER TABLE `pessoa`
    ADD COLUMN `tenantRootCompanyId` BIGINT NULL AFTER `publicId`;

ALTER TABLE `vinculo`
    ADD COLUMN `tenantRootCompanyId` BIGINT NULL AFTER `publicId`;

ALTER TABLE `ocorrencia`
    ADD COLUMN `tenantRootCompanyId` BIGINT NULL AFTER `publicId`;

ALTER TABLE `anexo`
    ADD COLUMN `tenantRootCompanyId` BIGINT NULL AFTER `publicId`;

ALTER TABLE `tag_entidade`
    ADD COLUMN `tenantRootCompanyId` BIGINT NULL AFTER `publicId`;

ALTER TABLE `agenda_item`
    ADD COLUMN `tenantRootCompanyId` BIGINT NULL AFTER `publicId`;

ALTER TABLE `security_events`
    ADD COLUMN `tenantRootCompanyId` BIGINT NULL AFTER `publicId`;

ALTER TABLE `log_auditoria`
    ADD COLUMN `tenantRootCompanyId` BIGINT NULL AFTER `publicId`;

-- CreateIndex
CREATE INDEX `usuario_sistema_tenantRootCompanyId_idx` ON `usuario_sistema`(`tenantRootCompanyId`);
CREATE INDEX `empresa_prestadora_tenantRootCompanyId_idx` ON `empresa_prestadora`(`tenantRootCompanyId`);
CREATE INDEX `cliente_contratante_tenantRootCompanyId_idx` ON `cliente_contratante`(`tenantRootCompanyId`);
CREATE INDEX `contrato_tenantRootCompanyId_idx` ON `contrato`(`tenantRootCompanyId`);
CREATE INDEX `posto_ou_vaga_tenantRootCompanyId_idx` ON `posto_ou_vaga`(`tenantRootCompanyId`);
CREATE INDEX `pessoa_tenantRootCompanyId_idx` ON `pessoa`(`tenantRootCompanyId`);
CREATE INDEX `vinculo_tenantRootCompanyId_idx` ON `vinculo`(`tenantRootCompanyId`);
CREATE INDEX `ocorrencia_tenantRootCompanyId_idx` ON `ocorrencia`(`tenantRootCompanyId`);
CREATE INDEX `anexo_tenantRootCompanyId_idx` ON `anexo`(`tenantRootCompanyId`);
CREATE INDEX `tag_entidade_tenantRootCompanyId_idx` ON `tag_entidade`(`tenantRootCompanyId`);
CREATE INDEX `agenda_item_tenantRootCompanyId_startsAt_idx` ON `agenda_item`(`tenantRootCompanyId`, `startsAt`);
CREATE INDEX `security_events_tenantRootCompanyId_createdAt_idx` ON `security_events`(`tenantRootCompanyId`, `createdAt`);
CREATE INDEX `log_auditoria_tenantRootCompanyId_createdAt_idx` ON `log_auditoria`(`tenantRootCompanyId`, `createdAt`);

-- AddForeignKey
ALTER TABLE `cliente_onboarding_solicitacao`
    ADD CONSTRAINT `cliente_onboarding_solicitacao_tenantRootCompanyId_fkey`
    FOREIGN KEY (`tenantRootCompanyId`) REFERENCES `empresa_raiz_cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `usuario_sistema`
    ADD CONSTRAINT `usuario_sistema_tenantRootCompanyId_fkey`
    FOREIGN KEY (`tenantRootCompanyId`) REFERENCES `empresa_raiz_cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `empresa_prestadora`
    ADD CONSTRAINT `empresa_prestadora_tenantRootCompanyId_fkey`
    FOREIGN KEY (`tenantRootCompanyId`) REFERENCES `empresa_raiz_cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `cliente_contratante`
    ADD CONSTRAINT `cliente_contratante_tenantRootCompanyId_fkey`
    FOREIGN KEY (`tenantRootCompanyId`) REFERENCES `empresa_raiz_cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `contrato`
    ADD CONSTRAINT `contrato_tenantRootCompanyId_fkey`
    FOREIGN KEY (`tenantRootCompanyId`) REFERENCES `empresa_raiz_cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `posto_ou_vaga`
    ADD CONSTRAINT `posto_ou_vaga_tenantRootCompanyId_fkey`
    FOREIGN KEY (`tenantRootCompanyId`) REFERENCES `empresa_raiz_cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `pessoa`
    ADD CONSTRAINT `pessoa_tenantRootCompanyId_fkey`
    FOREIGN KEY (`tenantRootCompanyId`) REFERENCES `empresa_raiz_cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `vinculo`
    ADD CONSTRAINT `vinculo_tenantRootCompanyId_fkey`
    FOREIGN KEY (`tenantRootCompanyId`) REFERENCES `empresa_raiz_cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ocorrencia`
    ADD CONSTRAINT `ocorrencia_tenantRootCompanyId_fkey`
    FOREIGN KEY (`tenantRootCompanyId`) REFERENCES `empresa_raiz_cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `anexo`
    ADD CONSTRAINT `anexo_tenantRootCompanyId_fkey`
    FOREIGN KEY (`tenantRootCompanyId`) REFERENCES `empresa_raiz_cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `tag_entidade`
    ADD CONSTRAINT `tag_entidade_tenantRootCompanyId_fkey`
    FOREIGN KEY (`tenantRootCompanyId`) REFERENCES `empresa_raiz_cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `agenda_item`
    ADD CONSTRAINT `agenda_item_tenantRootCompanyId_fkey`
    FOREIGN KEY (`tenantRootCompanyId`) REFERENCES `empresa_raiz_cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `security_events`
    ADD CONSTRAINT `security_events_tenantRootCompanyId_fkey`
    FOREIGN KEY (`tenantRootCompanyId`) REFERENCES `empresa_raiz_cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `log_auditoria`
    ADD CONSTRAINT `log_auditoria_tenantRootCompanyId_fkey`
    FOREIGN KEY (`tenantRootCompanyId`) REFERENCES `empresa_raiz_cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
