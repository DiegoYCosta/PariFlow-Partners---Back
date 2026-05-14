CREATE TABLE `usuario_empresa_raiz_acesso` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `publicId` VARCHAR(26) NOT NULL,
    `userSystemId` BIGINT NOT NULL,
    `tenantRootCompanyId` BIGINT NOT NULL,
    `accessProfileId` BIGINT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `usuario_empresa_raiz_acesso_publicId_key`(`publicId`),
    UNIQUE INDEX `usuario_empresa_raiz_acesso_userSystemId_tenantRootCompanyId_key`(`userSystemId`, `tenantRootCompanyId`),
    INDEX `usuario_empresa_raiz_acesso_tenantRootCompanyId_active_idx`(`tenantRootCompanyId`, `active`),
    INDEX `usuario_empresa_raiz_acesso_accessProfileId_idx`(`accessProfileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `usuario_empresa_raiz_acesso`
    ADD CONSTRAINT `usuario_empresa_raiz_acesso_userSystemId_fkey`
    FOREIGN KEY (`userSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `usuario_empresa_raiz_acesso`
    ADD CONSTRAINT `usuario_empresa_raiz_acesso_tenantRootCompanyId_fkey`
    FOREIGN KEY (`tenantRootCompanyId`) REFERENCES `empresa_raiz_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `usuario_empresa_raiz_acesso`
    ADD CONSTRAINT `usuario_empresa_raiz_acesso_accessProfileId_fkey`
    FOREIGN KEY (`accessProfileId`) REFERENCES `perfil_acesso`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `usuario_empresa_raiz_acesso` (
    `publicId`,
    `userSystemId`,
    `tenantRootCompanyId`,
    `accessProfileId`,
    `active`,
    `approvedAt`,
    `createdAt`,
    `updatedAt`
)
SELECT
    CONCAT('uta', LPAD(CAST(u.`id` AS CHAR), 23, '0')),
    u.`id`,
    u.`tenantRootCompanyId`,
    MIN(uap.`accessProfileId`),
    true,
    COALESCE(u.`lastAccessAt`, u.`updatedAt`, u.`createdAt`, CURRENT_TIMESTAMP(3)),
    u.`createdAt`,
    CURRENT_TIMESTAMP(3)
FROM `usuario_sistema` u
LEFT JOIN `usuario_perfil_acesso` uap ON uap.`userSystemId` = u.`id`
WHERE u.`tenantRootCompanyId` IS NOT NULL
GROUP BY u.`id`, u.`tenantRootCompanyId`, u.`lastAccessAt`, u.`updatedAt`, u.`createdAt`
ON DUPLICATE KEY UPDATE
    `active` = VALUES(`active`),
    `accessProfileId` = COALESCE(`usuario_empresa_raiz_acesso`.`accessProfileId`, VALUES(`accessProfileId`)),
    `updatedAt` = CURRENT_TIMESTAMP(3);

ALTER TABLE `refresh_tokens`
    ADD COLUMN `tenantRootCompanyId` BIGINT NULL AFTER `userSystemId`;

CREATE INDEX `refresh_tokens_tenantRootCompanyId_idx` ON `refresh_tokens`(`tenantRootCompanyId`);

ALTER TABLE `refresh_tokens`
    ADD CONSTRAINT `refresh_tokens_tenantRootCompanyId_fkey`
    FOREIGN KEY (`tenantRootCompanyId`) REFERENCES `empresa_raiz_cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
