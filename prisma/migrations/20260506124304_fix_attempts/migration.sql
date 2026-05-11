/*
  Warnings:

  - You are about to drop the `solved` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `solved` DROP FOREIGN KEY `fk_solved_question`;

-- DropForeignKey
ALTER TABLE `solved` DROP FOREIGN KEY `fk_solved_user`;

-- AlterTable
ALTER TABLE `attempts` ADD COLUMN `isCorrect` BOOLEAN NULL;

-- DropTable
DROP TABLE `solved`;
