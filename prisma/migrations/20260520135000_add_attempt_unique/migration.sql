-- Add a compound unique constraint so one user can have at most one attempt per question
ALTER TABLE `attempts`
  ADD CONSTRAINT `user_question_unique` UNIQUE (`userId`, `questionId`);
