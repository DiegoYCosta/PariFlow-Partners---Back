-- AlterTable
ALTER TABLE `sensitive_sessions`
    MODIFY `verifiedAt` DATETIME(3) NULL,
    ADD COLUMN `status` ENUM('PENDING', 'VERIFIED', 'EXPIRED', 'REVOKED') NOT NULL DEFAULT 'PENDING' AFTER `level`,
    ADD COLUMN `challengeHash` VARCHAR(128) NULL AFTER `justification`,
    ADD COLUMN `attemptCount` INTEGER NOT NULL DEFAULT 0 AFTER `challengeHash`,
    ADD COLUMN `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER `attemptCount`;

UPDATE `sensitive_sessions`
SET `status` = 'VERIFIED'
WHERE `verifiedAt` IS NOT NULL;

-- CreateIndex
CREATE INDEX `sensitive_sessions_userSystemId_status_expiresAt_idx`
    ON `sensitive_sessions`(`userSystemId`, `status`, `expiresAt`);
