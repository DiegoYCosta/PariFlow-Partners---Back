-- AlterTable
ALTER TABLE `notification_outbox`
    MODIFY `status` ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `attempts` INTEGER NOT NULL DEFAULT 0 AFTER `status`,
    ADD COLUMN `lastAttemptAt` DATETIME(3) NULL AFTER `queuedAt`,
    ADD COLUMN `nextAttemptAt` DATETIME(3) NULL AFTER `lastAttemptAt`;
