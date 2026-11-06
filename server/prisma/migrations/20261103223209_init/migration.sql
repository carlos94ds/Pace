-- CreateTable
CREATE TABLE `User` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `emailVerifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserProfile` (
    `userId` CHAR(36) NOT NULL,
    `username` VARCHAR(30) NOT NULL,
    `firstName` VARCHAR(60) NOT NULL,
    `bio` VARCHAR(280) NULL,
    `avatarKey` VARCHAR(255) NULL,
    `heightCm` SMALLINT NULL,
    `trainingLevel` ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'COMPETITIVE', 'PROFESSIONAL') NOT NULL DEFAULT 'BEGINNER',
    `personalGoals` TEXT NULL,
    `timezone` VARCHAR(64) NOT NULL DEFAULT 'Europe/Amsterdam',
    `gymId` CHAR(36) NULL,

    UNIQUE INDEX `UserProfile_username_key`(`username`),
    INDEX `UserProfile_firstName_idx`(`firstName`),
    INDEX `UserProfile_gymId_idx`(`gymId`),
    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthSession` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `userAgent` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AuthSession_tokenHash_key`(`tokenHash`),
    INDEX `AuthSession_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,

    UNIQUE INDEX `PasswordResetToken_tokenHash_key`(`tokenHash`),
    INDEX `PasswordResetToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PrivacySettings` (
    `userId` CHAR(36) NOT NULL,
    `discoverable` BOOLEAN NOT NULL DEFAULT true,
    `profileVisibility` ENUM('PRIVATE', 'FRIENDS') NOT NULL DEFAULT 'FRIENDS',
    `activityVisibility` ENUM('PRIVATE', 'FRIENDS') NOT NULL DEFAULT 'FRIENDS',
    `streaksVisibility` ENUM('PRIVATE', 'FRIENDS') NOT NULL DEFAULT 'FRIENDS',
    `achievementsVisibility` ENUM('PRIVATE', 'FRIENDS') NOT NULL DEFAULT 'FRIENDS',
    `dashboardVisibility` ENUM('PRIVATE', 'FRIENDS') NOT NULL DEFAULT 'PRIVATE',
    `weightVisibility` ENUM('PRIVATE', 'FRIENDS') NOT NULL DEFAULT 'PRIVATE',

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserPreferences` (
    `userId` CHAR(36) NOT NULL,
    `language` ENUM('NL', 'EN', 'DE', 'FR', 'PT', 'IT', 'ES') NOT NULL DEFAULT 'EN',
    `theme` ENUM('LIGHT', 'DARK', 'SYSTEM') NOT NULL DEFAULT 'SYSTEM',
    `textSize` ENUM('SMALL', 'MEDIUM', 'LARGE') NOT NULL DEFAULT 'MEDIUM',
    `notifyFriendRequests` BOOLEAN NOT NULL DEFAULT true,
    `notifyFriendAccepted` BOOLEAN NOT NULL DEFAULT true,
    `notifyFriendMilestones` BOOLEAN NOT NULL DEFAULT true,
    `notifyReactions` BOOLEAN NOT NULL DEFAULT true,
    `notifyWeeklyReport` BOOLEAN NOT NULL DEFAULT true,
    `notifyStreaks` BOOLEAN NOT NULL DEFAULT true,
    `notifyGoals` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sport` (
    `id` CHAR(36) NOT NULL,
    `slug` VARCHAR(40) NULL,
    `name` VARCHAR(50) NOT NULL,
    `color` CHAR(7) NOT NULL,
    `ownerId` CHAR(36) NULL,

    UNIQUE INDEX `Sport_slug_key`(`slug`),
    UNIQUE INDEX `Sport_ownerId_name_key`(`ownerId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserSport` (
    `userId` CHAR(36) NOT NULL,
    `sportId` CHAR(36) NOT NULL,

    INDEX `UserSport_sportId_idx`(`sportId`),
    PRIMARY KEY (`userId`, `sportId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Gym` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `city` VARCHAR(100) NOT NULL,
    `createdById` CHAR(36) NULL,

    INDEX `Gym_createdById_idx`(`createdById`),
    UNIQUE INDEX `Gym_name_city_key`(`name`, `city`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrainingSession` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `sportId` CHAR(36) NOT NULL,
    `gymId` CHAR(36) NULL,
    `date` DATE NOT NULL,
    `durationMinutes` SMALLINT NOT NULL,
    `punctuality` ENUM('ON_TIME', 'LATE') NOT NULL,
    `motivation` TINYINT NOT NULL,
    `rating` TINYINT NOT NULL,
    `intensity` TINYINT NOT NULL,
    `reflection` TEXT NULL,
    `shareDetails` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TrainingSession_userId_date_idx`(`userId`, `date`),
    INDEX `TrainingSession_sportId_idx`(`sportId`),
    INDEX `TrainingSession_gymId_idx`(`gymId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WeeklyGoal` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `type` ENUM('TOTAL_MINUTES', 'TRAINING_DAYS', 'PUNCTUALITY_PCT', 'SPORT_SESSIONS') NOT NULL,
    `target` INTEGER NOT NULL,
    `sportId` CHAR(36) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `archivedAt` DATETIME(3) NULL,

    INDEX `WeeklyGoal_userId_active_idx`(`userId`, `active`),
    INDEX `WeeklyGoal_sportId_idx`(`sportId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WeeklyReport` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `weekStart` DATE NOT NULL,
    `timezone` VARCHAR(64) NOT NULL,
    `stats` JSON NOT NULL,
    `goalResults` JSON NOT NULL,
    `comparison` JSON NOT NULL,
    `highlights` JSON NOT NULL,
    `conclusion` JSON NOT NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `viewedAt` DATETIME(3) NULL,

    UNIQUE INDEX `WeeklyReport_userId_weekStart_key`(`userId`, `weekStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Friendship` (
    `id` CHAR(36) NOT NULL,
    `requesterId` CHAR(36) NOT NULL,
    `addresseeId` CHAR(36) NOT NULL,
    `pairKey` CHAR(73) NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'DECLINED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `respondedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Friendship_pairKey_key`(`pairKey`),
    INDEX `Friendship_requesterId_status_idx`(`requesterId`, `status`),
    INDEX `Friendship_addresseeId_status_idx`(`addresseeId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reaction` (
    `id` CHAR(36) NOT NULL,
    `fromUserId` CHAR(36) NOT NULL,
    `toUserId` CHAR(36) NOT NULL,
    `targetType` ENUM('SESSION', 'ACHIEVEMENT', 'STREAK', 'WEEKLY_GOAL') NOT NULL,
    `targetId` VARCHAR(64) NOT NULL,
    `type` ENUM('RESPECT', 'WELL_DONE', 'KEEP_GOING') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Reaction_toUserId_createdAt_idx`(`toUserId`, `createdAt`),
    UNIQUE INDEX `Reaction_fromUserId_targetType_targetId_type_key`(`fromUserId`, `targetType`, `targetId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Achievement` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `category` ENUM('STREAK', 'VOLUME', 'GOAL', 'MILESTONE') NOT NULL,
    `threshold` INTEGER NOT NULL,
    `repeatable` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `Achievement_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserAchievement` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `achievementId` CHAR(36) NOT NULL,
    `periodKey` VARCHAR(10) NOT NULL DEFAULT '',
    `earnedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserAchievement_achievementId_idx`(`achievementId`),
    UNIQUE INDEX `UserAchievement_userId_achievementId_periodKey_key`(`userId`, `achievementId`, `periodKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `type` ENUM('FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'FRIEND_ACHIEVEMENT', 'REACTION', 'WEEKLY_REPORT', 'STREAK_MILESTONE', 'GOAL_ACHIEVED') NOT NULL,
    `actorId` CHAR(36) NULL,
    `payload` JSON NOT NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_readAt_createdAt_idx`(`userId`, `readAt`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WeightMeasurement` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `weightKg` DECIMAL(5, 2) NOT NULL,
    `measuredAt` DATETIME(3) NOT NULL,
    `note` VARCHAR(280) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WeightMeasurement_userId_measuredAt_idx`(`userId`, `measuredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WeightEvidence` (
    `id` CHAR(36) NOT NULL,
    `measurementId` CHAR(36) NOT NULL,
    `storageKey` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(50) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `sha256` CHAR(64) NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WeightEvidence_measurementId_key`(`measurementId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserProfile` ADD CONSTRAINT `UserProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserProfile` ADD CONSTRAINT `UserProfile_gymId_fkey` FOREIGN KEY (`gymId`) REFERENCES `Gym`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthSession` ADD CONSTRAINT `AuthSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PrivacySettings` ADD CONSTRAINT `PrivacySettings_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserPreferences` ADD CONSTRAINT `UserPreferences_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sport` ADD CONSTRAINT `Sport_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserSport` ADD CONSTRAINT `UserSport_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserSport` ADD CONSTRAINT `UserSport_sportId_fkey` FOREIGN KEY (`sportId`) REFERENCES `Sport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Gym` ADD CONSTRAINT `Gym_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrainingSession` ADD CONSTRAINT `TrainingSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrainingSession` ADD CONSTRAINT `TrainingSession_sportId_fkey` FOREIGN KEY (`sportId`) REFERENCES `Sport`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TrainingSession` ADD CONSTRAINT `TrainingSession_gymId_fkey` FOREIGN KEY (`gymId`) REFERENCES `Gym`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeeklyGoal` ADD CONSTRAINT `WeeklyGoal_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeeklyGoal` ADD CONSTRAINT `WeeklyGoal_sportId_fkey` FOREIGN KEY (`sportId`) REFERENCES `Sport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeeklyReport` ADD CONSTRAINT `WeeklyReport_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Friendship` ADD CONSTRAINT `Friendship_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Friendship` ADD CONSTRAINT `Friendship_addresseeId_fkey` FOREIGN KEY (`addresseeId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reaction` ADD CONSTRAINT `Reaction_fromUserId_fkey` FOREIGN KEY (`fromUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reaction` ADD CONSTRAINT `Reaction_toUserId_fkey` FOREIGN KEY (`toUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserAchievement` ADD CONSTRAINT `UserAchievement_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserAchievement` ADD CONSTRAINT `UserAchievement_achievementId_fkey` FOREIGN KEY (`achievementId`) REFERENCES `Achievement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeightMeasurement` ADD CONSTRAINT `WeightMeasurement_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeightEvidence` ADD CONSTRAINT `WeightEvidence_measurementId_fkey` FOREIGN KEY (`measurementId`) REFERENCES `WeightMeasurement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Value ranges Prisma can't express. Zod validates first; these are the last line of defence.
ALTER TABLE `TrainingSession`
    ADD CONSTRAINT `TrainingSession_duration_check` CHECK (`durationMinutes` BETWEEN 1 AND 1440),
    ADD CONSTRAINT `TrainingSession_motivation_check` CHECK (`motivation` BETWEEN 1 AND 5),
    ADD CONSTRAINT `TrainingSession_rating_check` CHECK (`rating` BETWEEN 1 AND 5),
    ADD CONSTRAINT `TrainingSession_intensity_check` CHECK (`intensity` BETWEEN 1 AND 5);

ALTER TABLE `WeeklyGoal`
    ADD CONSTRAINT `WeeklyGoal_target_check` CHECK (`target` > 0);

ALTER TABLE `WeightMeasurement`
    ADD CONSTRAINT `WeightMeasurement_weight_check` CHECK (`weightKg` BETWEEN 20 AND 400);

ALTER TABLE `UserProfile`
    ADD CONSTRAINT `UserProfile_height_check` CHECK (`heightCm` IS NULL OR `heightCm` BETWEEN 80 AND 260);

-- Friendship requester <> addressee is enforced in the application: MySQL doesn't allow
-- CHECK constraints on columns used by a cascading foreign key.
