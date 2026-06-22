-- AlterTable
ALTER TABLE `users` ADD COLUMN `deleted_at` DATETIME(3) NULL;
ALTER TABLE `users` ADD COLUMN `admin_notes` TEXT NULL;
