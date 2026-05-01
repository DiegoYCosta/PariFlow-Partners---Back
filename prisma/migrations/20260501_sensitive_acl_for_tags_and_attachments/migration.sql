-- AlterTable
ALTER TABLE `anexo`
    ADD COLUMN `ownerUserSystemId` BIGINT NULL AFTER `occurrenceId`,
    ADD COLUMN `createdByUserSystemId` BIGINT NULL AFTER `ownerUserSystemId`;

-- AlterTable
ALTER TABLE `tag_entidade`
    ADD COLUMN `ownerUserSystemId` BIGINT NULL AFTER `isAnonymousSubmission`;

-- CreateTable
CREATE TABLE `anexo_grupo_visibilidade` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `attachmentId` BIGINT NOT NULL,
    `groupKey` ENUM('DIRECTOR', 'SUPERVISION', 'AUXILIARY') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `anexo_grupo_visibilidade_attachmentId_groupKey_key`(`attachmentId`, `groupKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `anexo_usuario_visibilidade` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `attachmentId` BIGINT NOT NULL,
    `userSystemId` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `anexo_usuario_visibilidade_attachmentId_userSystemId_key`(`attachmentId`, `userSystemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tag_entidade_grupo_visibilidade` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `entityTagId` BIGINT NOT NULL,
    `groupKey` ENUM('DIRECTOR', 'SUPERVISION', 'AUXILIARY') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tag_entidade_grupo_visibilidade_entityTagId_groupKey_key`(`entityTagId`, `groupKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tag_entidade_usuario_visibilidade` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `entityTagId` BIGINT NOT NULL,
    `userSystemId` BIGINT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tag_entidade_usuario_visibilidade_entityTagId_userSystemId_key`(`entityTagId`, `userSystemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `anexo`
    ADD CONSTRAINT `anexo_ownerUserSystemId_fkey`
    FOREIGN KEY (`ownerUserSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `anexo`
    ADD CONSTRAINT `anexo_createdByUserSystemId_fkey`
    FOREIGN KEY (`createdByUserSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tag_entidade`
    ADD CONSTRAINT `tag_entidade_ownerUserSystemId_fkey`
    FOREIGN KEY (`ownerUserSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `anexo_grupo_visibilidade`
    ADD CONSTRAINT `anexo_grupo_visibilidade_attachmentId_fkey`
    FOREIGN KEY (`attachmentId`) REFERENCES `anexo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `anexo_usuario_visibilidade`
    ADD CONSTRAINT `anexo_usuario_visibilidade_attachmentId_fkey`
    FOREIGN KEY (`attachmentId`) REFERENCES `anexo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `anexo_usuario_visibilidade_userSystemId_fkey`
    FOREIGN KEY (`userSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tag_entidade_grupo_visibilidade`
    ADD CONSTRAINT `tag_entidade_grupo_visibilidade_entityTagId_fkey`
    FOREIGN KEY (`entityTagId`) REFERENCES `tag_entidade`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tag_entidade_usuario_visibilidade`
    ADD CONSTRAINT `tag_entidade_usuario_visibilidade_entityTagId_fkey`
    FOREIGN KEY (`entityTagId`) REFERENCES `tag_entidade`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `tag_entidade_usuario_visibilidade_userSystemId_fkey`
    FOREIGN KEY (`userSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;