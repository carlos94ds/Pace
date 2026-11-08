-- A user can now train at several gyms instead of one.

-- CreateTable
CREATE TABLE `UserGym` (
    `userId` CHAR(36) NOT NULL,
    `gymId` CHAR(36) NOT NULL,
    `position` TINYINT NOT NULL,

    INDEX `UserGym_gymId_idx`(`gymId`),
    PRIMARY KEY (`userId`, `gymId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserGym` ADD CONSTRAINT `UserGym_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserGym` ADD CONSTRAINT `UserGym_gymId_fkey` FOREIGN KEY (`gymId`) REFERENCES `Gym`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep each user's existing gym as their first gym.
INSERT INTO `UserGym` (`userId`, `gymId`, `position`)
SELECT `userId`, `gymId`, 0 FROM `UserProfile` WHERE `gymId` IS NOT NULL;

-- DropForeignKey
ALTER TABLE `UserProfile` DROP FOREIGN KEY `UserProfile_gymId_fkey`;

-- DropIndex
DROP INDEX `UserProfile_gymId_idx` ON `UserProfile`;

-- AlterTable
ALTER TABLE `UserProfile` DROP COLUMN `gymId`;
