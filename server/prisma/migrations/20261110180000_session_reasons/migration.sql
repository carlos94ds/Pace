-- The check-in asks why a training went well or badly, why energy was high or low,
-- and what the user thinks caused an injury. All optional and private.

-- AlterTable
ALTER TABLE `TrainingSession`
    ADD COLUMN `injuryCause` VARCHAR(500) NULL,
    ADD COLUMN `ratingReason` VARCHAR(500) NULL,
    ADD COLUMN `energyReason` VARCHAR(500) NULL;
