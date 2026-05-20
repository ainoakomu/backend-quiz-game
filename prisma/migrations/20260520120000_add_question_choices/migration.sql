-- Add a JSON column to store multiple-choice options
ALTER TABLE `questions`
  ADD COLUMN `choices` JSON NULL;
