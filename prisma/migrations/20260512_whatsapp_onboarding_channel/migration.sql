-- AlterTable
ALTER TABLE `cliente_onboarding_verificacao`
    MODIFY `channel` ENUM('EMAIL', 'PHONE', 'WHATSAPP', 'NONE') NOT NULL;

ALTER TABLE `cliente_onboarding_solicitacao`
    MODIFY `verificationChannel` ENUM('EMAIL', 'PHONE', 'WHATSAPP', 'NONE') NOT NULL DEFAULT 'NONE';
