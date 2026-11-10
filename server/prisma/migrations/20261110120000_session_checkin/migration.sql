-- The training form now asks for energy level and injuries.
-- Motivation and intensity are no longer asked; older sessions keep their values.

-- AlterTable
ALTER TABLE `TrainingSession`
    MODIFY `motivation` TINYINT NULL,
    MODIFY `intensity` TINYINT NULL,
    ADD COLUMN `energy` TINYINT NULL,
    ADD COLUMN `injured` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `injuryNote` VARCHAR(500) NULL;

ALTER TABLE `TrainingSession`
    ADD CONSTRAINT `TrainingSession_energy_check` CHECK (`energy` IS NULL OR `energy` BETWEEN 1 AND 5);
