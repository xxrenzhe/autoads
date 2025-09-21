ALTER TABLE `idempotency_requests`
  ADD COLUMN `response_status` INT NULL AFTER `status`,
  ADD COLUMN `response_body` JSON NULL AFTER `response_status`,
  ADD COLUMN `expires_at` DATETIME NULL AFTER `updated_at`;

