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

-- AlterTable
ALTER TABLE `agenda_dia_nao_util`
    ADD COLUMN `stateCode` VARCHAR(2) NULL AFTER `regionCode`;

-- CreateIndex
CREATE INDEX `agenda_item_tenantRootCompanyId_appliesToRegionCode_idx`
    ON `agenda_item`(`tenantRootCompanyId`, `appliesToRegionCode`);

-- CreateIndex
CREATE INDEX `agenda_item_tenantRootCompanyId_appliesToStateCode_idx`
    ON `agenda_item`(`tenantRootCompanyId`, `appliesToStateCode`);

-- CreateIndex
CREATE INDEX `agenda_dia_nao_util_tenantRootCompanyId_stateCode_active_idx`
    ON `agenda_dia_nao_util`(`tenantRootCompanyId`, `stateCode`, `active`);
