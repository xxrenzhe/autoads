-- Add composite index to support frequent subscription queries by user/status/date
ALTER TABLE `subscriptions`
  ADD INDEX `idx_sub_user_status_end` (`userId`,`status`,`currentPeriodEnd`);

-- Add composite index to accelerate token transaction filtering by user/source/time
ALTER TABLE `token_transactions`
  ADD INDEX `idx_tt_user_source_created` (`userId`,`source`,`createdAt`);

