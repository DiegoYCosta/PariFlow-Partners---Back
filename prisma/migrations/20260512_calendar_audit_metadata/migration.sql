ALTER TABLE `agenda_item`
    ADD COLUMN `updatedByUserSystemId` BIGINT NULL AFTER `assignedToUserSystemId`,
    ADD COLUMN `lastEditJustification` VARCHAR(180) NULL AFTER `updatedByUserSystemId`,
    ADD INDEX `agenda_item_updatedByUserSystemId_updatedAt_idx`(`updatedByUserSystemId`, `updatedAt`);

ALTER TABLE `agenda_item`
    ADD CONSTRAINT `agenda_item_updatedByUserSystemId_fkey`
    FOREIGN KEY (`updatedByUserSystemId`) REFERENCES `usuario_sistema`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
