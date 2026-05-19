-- Add imagePublicId column to questions
ALTER TABLE `questions`
  ADD COLUMN `imagePublicId` VARCHAR(255) NULL;
