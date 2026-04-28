-- CreateTable
CREATE TABLE `usuario_sistema` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `firebaseUid` VARCHAR(128) NULL,
    `name` VARCHAR(160) NOT NULL,
    `email` VARCHAR(180) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
    `mfaEnabled` BOOLEAN NOT NULL DEFAULT false,
    `lastAccessAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `usuario_sistema_publicId_key`(`publicId`),
    UNIQUE INDEX `usuario_sistema_firebaseUid_key`(`firebaseUid`),
    UNIQUE INDEX `usuario_sistema_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `perfil_acesso` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `code` ENUM('ADMIN', 'EXECUTIVE', 'LEGAL', 'HR', 'OPERATIONS') NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(255) NULL,
    `canViewSensitive` BOOLEAN NOT NULL DEFAULT false,
    `canDownload` BOOLEAN NOT NULL DEFAULT false,
    `canSoftDelete` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `perfil_acesso_publicId_key`(`publicId`),
    UNIQUE INDEX `perfil_acesso_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuario_perfil_acesso` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `userSystemId` BIGINT NOT NULL,
    `accessProfileId` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `usuario_perfil_acesso_userSystemId_accessProfileId_key`(`userSystemId`, `accessProfileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `empresa_prestadora` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `legalName` VARCHAR(180) NOT NULL,
    `tradeName` VARCHAR(180) NULL,
    `document` VARCHAR(20) NOT NULL,
    `status` VARCHAR(30) NOT NULL,
    `contactsJson` JSON NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `empresa_prestadora_publicId_key`(`publicId`),
    UNIQUE INDEX `empresa_prestadora_document_key`(`document`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cliente_contratante` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `document` VARCHAR(20) NULL,
    `clientType` VARCHAR(60) NOT NULL,
    `addressJson` JSON NULL,
    `contactName` VARCHAR(160) NULL,
    `status` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cliente_contratante_publicId_key`(`publicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contrato` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `providerCompanyId` BIGINT NOT NULL,
    `clientCompanyId` BIGINT NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NULL,
    `status` VARCHAR(30) NOT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `contrato_publicId_key`(`publicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `servico` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `category` VARCHAR(80) NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `servico_publicId_key`(`publicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `posto_ou_vaga` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `contractId` BIGINT NOT NULL,
    `serviceId` BIGINT NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `location` VARCHAR(180) NULL,
    `shift` VARCHAR(120) NULL,
    `schedule` VARCHAR(120) NULL,
    `requirements` TEXT NULL,
    `status` VARCHAR(30) NOT NULL,

    UNIQUE INDEX `posto_ou_vaga_publicId_key`(`publicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pessoa` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `cpf` VARCHAR(14) NULL,
    `rg` VARCHAR(30) NULL,
    `email` VARCHAR(180) NULL,
    `phone` VARCHAR(30) NULL,
    `birthDate` DATETIME(3) NULL,
    `addressJson` JSON NULL,
    `notes` TEXT NULL,

    UNIQUE INDEX `pessoa_publicId_key`(`publicId`),
    UNIQUE INDEX `pessoa_cpf_key`(`cpf`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trabalho_externo` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `personId` BIGINT NOT NULL,
    `companyName` VARCHAR(180) NOT NULL,
    `roleName` VARCHAR(120) NULL,
    `schedule` VARCHAR(120) NULL,
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `status` VARCHAR(30) NULL,
    `notes` TEXT NULL,

    UNIQUE INDEX `trabalho_externo_publicId_key`(`publicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vinculo` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `personId` BIGINT NOT NULL,
    `providerCompanyId` BIGINT NOT NULL,
    `contractId` BIGINT NOT NULL,
    `positionId` BIGINT NOT NULL,
    `type` VARCHAR(60) NOT NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'DISMISSED', 'BLOCKED') NOT NULL DEFAULT 'PENDING',
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NULL,

    UNIQUE INDEX `vinculo_publicId_key`(`publicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `movimentacao_vinculo` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `employmentLinkId` BIGINT NOT NULL,
    `moveType` VARCHAR(60) NOT NULL,
    `origin` VARCHAR(160) NULL,
    `destination` VARCHAR(160) NULL,
    `movedAt` DATETIME(3) NOT NULL,
    `notes` TEXT NULL,

    UNIQUE INDEX `movimentacao_vinculo_publicId_key`(`publicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `desligamento` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `employmentLinkId` BIGINT NOT NULL,
    `dismissedAt` DATETIME(3) NOT NULL,
    `reason` VARCHAR(180) NOT NULL,
    `dismissalType` VARCHAR(60) NULL,
    `riskSummary` TEXT NULL,
    `pendingIssues` TEXT NULL,
    `legalNotes` TEXT NULL,

    UNIQUE INDEX `desligamento_publicId_key`(`publicId`),
    UNIQUE INDEX `desligamento_employmentLinkId_key`(`employmentLinkId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ocorrencia` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `personId` BIGINT NOT NULL,
    `providerCompanyId` BIGINT NULL,
    `employmentLinkId` BIGINT NULL,
    `positionId` BIGINT NULL,
    `type` VARCHAR(80) NOT NULL,
    `scope` VARCHAR(60) NOT NULL,
    `nature` ENUM('POSITIVE', 'NEUTRAL', 'NEGATIVE') NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `description` TEXT NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `severityLevel` VARCHAR(40) NOT NULL,
    `visibility` ENUM('INTERNAL', 'SENSITIVE', 'CRITICAL') NOT NULL DEFAULT 'INTERNAL',
    `showInExecutivePanel` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ocorrencia_publicId_key`(`publicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `anexo` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `occurrenceId` BIGINT NOT NULL,
    `displayScope` VARCHAR(60) NOT NULL,
    `fileName` VARCHAR(180) NOT NULL,
    `mimeType` VARCHAR(120) NULL,
    `storagePath` VARCHAR(255) NULL,
    `externalLink` VARCHAR(255) NULL,
    `physicalLocation` VARCHAR(255) NULL,
    `visibleInExecutive` BOOLEAN NOT NULL DEFAULT false,
    `visibleInContext` BOOLEAN NOT NULL DEFAULT true,
    `requiresConfirmation` BOOLEAN NOT NULL DEFAULT false,
    `version` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('ACTIVE', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
    `deletedAt` DATETIME(3) NULL,
    `deleteReason` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `anexo_publicId_key`(`publicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recebimento_documento` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `occurrenceId` BIGINT NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL,
    `channel` VARCHAR(80) NULL,
    `receivedBy` VARCHAR(160) NULL,
    `notes` TEXT NULL,

    UNIQUE INDEX `recebimento_documento_publicId_key`(`publicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `userSystemId` BIGINT NOT NULL,
    `tokenHash` VARCHAR(255) NOT NULL,
    `status` ENUM('ACTIVE', 'ROTATED', 'REVOKED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `expiresAt` DATETIME(3) NOT NULL,
    `rotatedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `ipAddress` VARCHAR(64) NULL,
    `userAgent` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_publicId_key`(`publicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sensitive_sessions` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `userSystemId` BIGINT NOT NULL,
    `level` ENUM('SENSITIVE', 'CRITICAL') NOT NULL,
    `justification` TEXT NULL,
    `verifiedAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `ipAddress` VARCHAR(64) NULL,
    `userAgent` VARCHAR(255) NULL,

    UNIQUE INDEX `sensitive_sessions_publicId_key`(`publicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `security_events` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `userSystemId` BIGINT NULL,
    `eventType` ENUM('LOGIN_SUCCESS', 'LOGIN_FAILURE', 'SESSION_EXCHANGED', 'REFRESH_ROTATED', 'SENSITIVE_SESSION_STARTED', 'SENSITIVE_SESSION_VERIFIED', 'ACCESS_DENIED') NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `ipAddress` VARCHAR(64) NULL,
    `userAgent` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `security_events_publicId_key`(`publicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `log_auditoria` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `userSystemId` BIGINT NULL,
    `entityName` VARCHAR(80) NOT NULL,
    `entityPublicId` VARCHAR(26) NULL,
    `action` VARCHAR(60) NOT NULL,
    `description` TEXT NULL,
    `ipAddress` VARCHAR(64) NULL,
    `device` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `log_auditoria_publicId_key`(`publicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `usuario_perfil_acesso` ADD CONSTRAINT `usuario_perfil_acesso_userSystemId_fkey` FOREIGN KEY (`userSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuario_perfil_acesso` ADD CONSTRAINT `usuario_perfil_acesso_accessProfileId_fkey` FOREIGN KEY (`accessProfileId`) REFERENCES `perfil_acesso`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contrato` ADD CONSTRAINT `contrato_providerCompanyId_fkey` FOREIGN KEY (`providerCompanyId`) REFERENCES `empresa_prestadora`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contrato` ADD CONSTRAINT `contrato_clientCompanyId_fkey` FOREIGN KEY (`clientCompanyId`) REFERENCES `cliente_contratante`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posto_ou_vaga` ADD CONSTRAINT `posto_ou_vaga_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contrato`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `posto_ou_vaga` ADD CONSTRAINT `posto_ou_vaga_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `servico`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trabalho_externo` ADD CONSTRAINT `trabalho_externo_personId_fkey` FOREIGN KEY (`personId`) REFERENCES `pessoa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vinculo` ADD CONSTRAINT `vinculo_personId_fkey` FOREIGN KEY (`personId`) REFERENCES `pessoa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vinculo` ADD CONSTRAINT `vinculo_providerCompanyId_fkey` FOREIGN KEY (`providerCompanyId`) REFERENCES `empresa_prestadora`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vinculo` ADD CONSTRAINT `vinculo_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `contrato`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vinculo` ADD CONSTRAINT `vinculo_positionId_fkey` FOREIGN KEY (`positionId`) REFERENCES `posto_ou_vaga`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimentacao_vinculo` ADD CONSTRAINT `movimentacao_vinculo_employmentLinkId_fkey` FOREIGN KEY (`employmentLinkId`) REFERENCES `vinculo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `desligamento` ADD CONSTRAINT `desligamento_employmentLinkId_fkey` FOREIGN KEY (`employmentLinkId`) REFERENCES `vinculo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ocorrencia` ADD CONSTRAINT `ocorrencia_personId_fkey` FOREIGN KEY (`personId`) REFERENCES `pessoa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ocorrencia` ADD CONSTRAINT `ocorrencia_providerCompanyId_fkey` FOREIGN KEY (`providerCompanyId`) REFERENCES `empresa_prestadora`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ocorrencia` ADD CONSTRAINT `ocorrencia_employmentLinkId_fkey` FOREIGN KEY (`employmentLinkId`) REFERENCES `vinculo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ocorrencia` ADD CONSTRAINT `ocorrencia_positionId_fkey` FOREIGN KEY (`positionId`) REFERENCES `posto_ou_vaga`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `anexo` ADD CONSTRAINT `anexo_occurrenceId_fkey` FOREIGN KEY (`occurrenceId`) REFERENCES `ocorrencia`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recebimento_documento` ADD CONSTRAINT `recebimento_documento_occurrenceId_fkey` FOREIGN KEY (`occurrenceId`) REFERENCES `ocorrencia`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_userSystemId_fkey` FOREIGN KEY (`userSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sensitive_sessions` ADD CONSTRAINT `sensitive_sessions_userSystemId_fkey` FOREIGN KEY (`userSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `security_events` ADD CONSTRAINT `security_events_userSystemId_fkey` FOREIGN KEY (`userSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `log_auditoria` ADD CONSTRAINT `log_auditoria_userSystemId_fkey` FOREIGN KEY (`userSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

