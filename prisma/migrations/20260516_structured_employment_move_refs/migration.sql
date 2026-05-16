ALTER TABLE `movimentacao_vinculo`
    ADD COLUMN `originPositionId` BIGINT NULL AFTER `destination`,
    ADD COLUMN `destinationPositionId` BIGINT NULL AFTER `originPositionId`,
    ADD COLUMN `originContractId` BIGINT NULL AFTER `destinationPositionId`,
    ADD COLUMN `destinationContractId` BIGINT NULL AFTER `originContractId`;

CREATE INDEX `movimentacao_vinculo_originPositionId_idx`
    ON `movimentacao_vinculo`(`originPositionId`);

CREATE INDEX `movimentacao_vinculo_destinationPositionId_idx`
    ON `movimentacao_vinculo`(`destinationPositionId`);

CREATE INDEX `movimentacao_vinculo_originContractId_idx`
    ON `movimentacao_vinculo`(`originContractId`);

CREATE INDEX `movimentacao_vinculo_destinationContractId_idx`
    ON `movimentacao_vinculo`(`destinationContractId`);

ALTER TABLE `movimentacao_vinculo`
    ADD CONSTRAINT `movimentacao_vinculo_originPositionId_fkey`
    FOREIGN KEY (`originPositionId`) REFERENCES `posto_ou_vaga`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `movimentacao_vinculo_destinationPositionId_fkey`
    FOREIGN KEY (`destinationPositionId`) REFERENCES `posto_ou_vaga`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `movimentacao_vinculo_originContractId_fkey`
    FOREIGN KEY (`originContractId`) REFERENCES `contrato`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `movimentacao_vinculo_destinationContractId_fkey`
    FOREIGN KEY (`destinationContractId`) REFERENCES `contrato`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
