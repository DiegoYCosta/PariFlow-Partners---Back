-- AlterTable
ALTER TABLE `empresa_prestadora`
    ADD COLUMN `addressJson` JSON NULL AFTER `contactsJson`;

-- AlterTable
ALTER TABLE `usuario_sistema`
    ADD COLUMN `addressJson` JSON NULL AFTER `email`;

-- AlterTable
ALTER TABLE `agenda_item`
    ADD COLUMN `appliesToRegionCode` VARCHAR(40) NULL AFTER `holidayRegionCode`,
    ADD COLUMN `appliesToStateCode` VARCHAR(2) NULL AFTER `appliesToRegionCode`,
    ADD COLUMN `appliesToCityName` VARCHAR(120) NULL AFTER `appliesToStateCode`;

-- CreateIndex
CREATE INDEX `agenda_item_tenantRootCompanyId_appliesToRegionCode_idx`
    ON `agenda_item`(`tenantRootCompanyId`, `appliesToRegionCode`);

-- CreateIndex
CREATE INDEX `agenda_item_tenantRootCompanyId_appliesToStateCode_idx`
    ON `agenda_item`(`tenantRootCompanyId`, `appliesToStateCode`);
