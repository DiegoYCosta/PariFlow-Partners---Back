ALTER TABLE `timeline_record`
    ADD COLUMN `createdByUserSystemName` VARCHAR(160) NULL AFTER `createdByUserSystemPublicId`,
    ADD COLUMN `updatedByUserSystemPublicId` VARCHAR(26) NULL AFTER `createdByUserSystemName`,
    ADD COLUMN `updatedByUserSystemName` VARCHAR(160) NULL AFTER `updatedByUserSystemPublicId`,
    ADD COLUMN `lastEditJustification` VARCHAR(180) NULL AFTER `updatedByUserSystemName`;
