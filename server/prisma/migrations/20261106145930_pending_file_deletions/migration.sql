-- CreateTable
CREATE TABLE `PendingFileDeletion` (
    `id` CHAR(36) NOT NULL,
    `key` VARCHAR(255) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lastError` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PendingFileDeletion_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
