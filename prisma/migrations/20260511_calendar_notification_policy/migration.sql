-- AlterTable
ALTER TABLE `agenda_item`
    ADD COLUMN `notificationPolicy` ENUM('ON_DUE_DATE', 'ONE_BUSINESS_DAY_BEFORE', 'SAME_DAY_OR_PREVIOUS_BUSINESS_DAY', 'CUSTOM_BUSINESS_DAYS_BEFORE') NOT NULL DEFAULT 'ON_DUE_DATE' AFTER `holidayRegionCode`,
    ADD COLUMN `notificationOffsetBusinessDays` INTEGER NOT NULL DEFAULT 0 AFTER `notificationPolicy`,
    ADD COLUMN `notificationTime` VARCHAR(5) NOT NULL DEFAULT '09:00' AFTER `notificationOffsetBusinessDays`,
    ADD COLUMN `notificationScheduledAt` DATETIME(3) NULL AFTER `notificationTime`,
    ADD COLUMN `notificationChannelsJson` JSON NULL AFTER `notificationScheduledAt`;

CREATE INDEX `agenda_item_notificationScheduledAt_idx` ON `agenda_item`(`notificationScheduledAt`);
