-- AlterTable
ALTER TABLE `contrato`
    ADD COLUMN `contractTypeId` BIGINT NULL AFTER `clientCompanyId`,
    ADD COLUMN `contractModelId` BIGINT NULL AFTER `contractTypeId`;

-- CreateTable
CREATE TABLE `tipo_contrato` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tipo_contrato_publicId_key`(`publicId`),
    UNIQUE INDEX `tipo_contrato_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `modelo_contrato` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `contractTypeId` BIGINT NOT NULL,
    `name` VARCHAR(140) NOT NULL,
    `description` TEXT NULL,
    `defaultSchedule` VARCHAR(120) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `modelo_contrato_publicId_key`(`publicId`),
    UNIQUE INDEX `modelo_contrato_contractTypeId_name_key`(`contractTypeId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documento_contrato` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `contractId` BIGINT NOT NULL,
    `title` VARCHAR(180) NOT NULL,
    `classification` ENUM('FORMAL_DOCUMENT', 'SENSITIVE_ATTACHMENT', 'SUPPORTING_REFERENCE') NOT NULL DEFAULT 'FORMAL_DOCUMENT',
    `fileName` VARCHAR(180) NULL,
    `mimeType` VARCHAR(120) NULL,
    `externalLink` VARCHAR(255) NULL,
    `physicalLocation` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `status` ENUM('ACTIVE', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `documento_contrato_publicId_key`(`publicId`),
    INDEX `documento_contrato_contractId_status_idx`(`contractId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed required base contract type and reusable models.
INSERT INTO `tipo_contrato` (`publicId`, `name`, `description`, `status`, `updatedAt`)
VALUES
    ('tco_seed_contratacao', 'Contratacao', 'Tipo base para contratos de prestacao ou contratacao operacional.', 'ACTIVE', CURRENT_TIMESTAMP(3)),
    ('tco_seed_locacao', 'Locacao', 'Tipo base para contratos de locacao.', 'ACTIVE', CURRENT_TIMESTAMP(3)),
    ('tco_seed_demissao', 'Demissao', 'Tipo base para documentos e contratos ligados a desligamento.', 'ACTIVE', CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
    `description` = VALUES(`description`),
    `status` = VALUES(`status`),
    `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT INTO `modelo_contrato` (`publicId`, `contractTypeId`, `name`, `description`, `defaultSchedule`, `status`, `updatedAt`)
SELECT 'mco_seed_limpeza_12x36', `id`, 'Limpeza 12x36', 'Modelo reutilizavel de contrato para escala de limpeza 12x36. Nao cria relacao entre empresas que usam o mesmo modelo.', '12x36', 'ACTIVE', CURRENT_TIMESTAMP(3)
FROM `tipo_contrato`
WHERE `publicId` = 'tco_seed_contratacao'
ON DUPLICATE KEY UPDATE
    `description` = VALUES(`description`),
    `defaultSchedule` = VALUES(`defaultSchedule`),
    `status` = VALUES(`status`),
    `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT INTO `modelo_contrato` (`publicId`, `contractTypeId`, `name`, `description`, `defaultSchedule`, `status`, `updatedAt`)
SELECT 'mco_seed_limpeza_22h', `id`, 'Limpeza 22hrs semanais', 'Modelo reutilizavel de contrato para limpeza parcial semanal.', '22hrs semanais', 'ACTIVE', CURRENT_TIMESTAMP(3)
FROM `tipo_contrato`
WHERE `publicId` = 'tco_seed_contratacao'
ON DUPLICATE KEY UPDATE
    `description` = VALUES(`description`),
    `defaultSchedule` = VALUES(`defaultSchedule`),
    `status` = VALUES(`status`),
    `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT INTO `modelo_contrato` (`publicId`, `contractTypeId`, `name`, `description`, `defaultSchedule`, `status`, `updatedAt`)
SELECT 'mco_seed_portaria_12x36', `id`, 'Portaria 12x36', 'Modelo reutilizavel de contrato para cobertura de portaria 12x36.', '12x36', 'ACTIVE', CURRENT_TIMESTAMP(3)
FROM `tipo_contrato`
WHERE `publicId` = 'tco_seed_contratacao'
ON DUPLICATE KEY UPDATE
    `description` = VALUES(`description`),
    `defaultSchedule` = VALUES(`defaultSchedule`),
    `status` = VALUES(`status`),
    `updatedAt` = CURRENT_TIMESTAMP(3);

-- Backfill existing contracts with the required base type.
UPDATE `contrato`
SET `contractTypeId` = (
    SELECT `id`
    FROM `tipo_contrato`
    WHERE `publicId` = 'tco_seed_contratacao'
)
WHERE `contractTypeId` IS NULL;

-- AddForeignKey
ALTER TABLE `contrato`
    ADD CONSTRAINT `contrato_contractTypeId_fkey`
    FOREIGN KEY (`contractTypeId`) REFERENCES `tipo_contrato`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contrato`
    ADD CONSTRAINT `contrato_contractModelId_fkey`
    FOREIGN KEY (`contractModelId`) REFERENCES `modelo_contrato`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `modelo_contrato`
    ADD CONSTRAINT `modelo_contrato_contractTypeId_fkey`
    FOREIGN KEY (`contractTypeId`) REFERENCES `tipo_contrato`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documento_contrato`
    ADD CONSTRAINT `documento_contrato_contractId_fkey`
    FOREIGN KEY (`contractId`) REFERENCES `contrato`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
