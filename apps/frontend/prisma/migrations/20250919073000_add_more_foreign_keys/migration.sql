-- Add more foreign keys for secondary relations

-- Preflight: indexes for FK columns (no-op if already exist)
ALTER TABLE `accounts` ADD INDEX `idx_accounts_userId` (`userId`);
ALTER TABLE `sessions` ADD INDEX `idx_sessions_userId` (`userId`);
ALTER TABLE `user_devices` ADD INDEX `idx_user_devices_userId` (`userId`);
ALTER TABLE `environment_variables` ADD INDEX `idx_env_vars_createdBy` (`createdBy`), ADD INDEX `idx_env_vars_updatedBy` (`updatedBy`);
ALTER TABLE `admin_logs` ADD INDEX `idx_admin_logs_userId` (`userId`);
ALTER TABLE `user_activities` ADD INDEX `idx_user_activities_userId` (`userId`);
ALTER TABLE `api_usages` ADD INDEX `idx_api_usages_userId` (`userId`);
ALTER TABLE `audit_logs` ADD INDEX `idx_audit_logs_userId` (`userId`);
ALTER TABLE `notification_logs` ADD INDEX `idx_notification_logs_userId` (`userId`), ADD INDEX `idx_notification_logs_templateId` (`templateId`);
ALTER TABLE `plan_features` ADD INDEX `idx_plan_features_planId` (`planId`);
ALTER TABLE `token_purchases` ADD INDEX `idx_token_purchases_userId` (`userId`);
ALTER TABLE `invitations` ADD INDEX `idx_invitations_inviterId` (`inviterId`), ADD INDEX `idx_invitations_invitedId` (`invitedId`);
ALTER TABLE `check_ins` ADD INDEX `idx_check_ins_userId` (`userId`);
ALTER TABLE `ads_accounts` ADD INDEX `idx_ads_accounts_userId` (`userId`);
ALTER TABLE `ads_configurations` ADD INDEX `idx_ads_configurations_userId` (`userId`);
ALTER TABLE `ads_executions` ADD INDEX `idx_ads_executions_userId` (`userId`), ADD INDEX `idx_ads_executions_configurationId` (`configurationId`);
ALTER TABLE `batch_jobs` ADD INDEX `idx_batch_jobs_userId` (`user_id`);
ALTER TABLE `batch_job_items` ADD INDEX `idx_batch_job_items_jobId` (`job_id`);
ALTER TABLE `batch_job_progress` ADD INDEX `idx_batch_job_progress_jobId` (`job_id`);
ALTER TABLE `autoclick_schedules` ADD INDEX `idx_autoclick_schedules_userId` (`user_id`);
ALTER TABLE `autoclick_daily_plans` ADD INDEX `idx_autoclick_daily_plans_scheduleId` (`schedule_id`);
ALTER TABLE `autoclick_executions` ADD INDEX `idx_autoclick_executions_scheduleId` (`schedule_id`);
ALTER TABLE `autoclick_execution_snapshots` ADD INDEX `idx_autoclick_snapshots_executionId` (`execution_id`);
ALTER TABLE `ads_offers` ADD INDEX `idx_ads_offers_userId` (`user_id`);
ALTER TABLE `ads_offer_bindings` ADD INDEX `idx_ads_offer_bindings_offerId` (`offer_id`), ADD INDEX `idx_ads_offer_bindings_userId` (`user_id`);
ALTER TABLE `ads_offer_rotations` ADD INDEX `idx_ads_offer_rotations_bindingId` (`binding_id`);

-- Orphan cleanup
DELETE a FROM `accounts` a LEFT JOIN `users` u ON u.id=a.`userId` WHERE u.id IS NULL;
DELETE s FROM `sessions` s LEFT JOIN `users` u ON u.id=s.`userId` WHERE u.id IS NULL;
DELETE d FROM `user_devices` d LEFT JOIN `users` u ON u.id=d.`userId` WHERE u.id IS NULL;
-- environment_variables.createdBy must exist; updatedBy may be NULL
DELETE ev FROM `environment_variables` ev LEFT JOIN `users` u ON u.id=ev.`createdBy` WHERE u.id IS NULL;
UPDATE `environment_variables` ev LEFT JOIN `users` u ON u.id=ev.`updatedBy` SET ev.`updatedBy`=NULL WHERE ev.`updatedBy` IS NOT NULL AND u.id IS NULL;
DELETE al FROM `admin_logs` al LEFT JOIN `users` u ON u.id=al.`userId` WHERE u.id IS NULL;
DELETE ua FROM `user_activities` ua LEFT JOIN `users` u ON u.id=ua.`userId` WHERE u.id IS NULL;
DELETE au FROM `api_usages` au LEFT JOIN `users` u ON u.id=au.`userId` WHERE u.id IS NULL;
UPDATE `audit_logs` al LEFT JOIN `users` u ON u.id=al.`userId` SET al.`userId`=NULL WHERE u.id IS NULL;
DELETE nl FROM `notification_logs` nl LEFT JOIN `users` u ON u.id=nl.`userId` WHERE u.id IS NULL;
-- notification_logs.templateId cannot be NULL; restrict template deletion, so cleanup not needed here
DELETE pf FROM `plan_features` pf LEFT JOIN `plans` p ON p.id=pf.`planId` WHERE p.id IS NULL;
DELETE tp FROM `token_purchases` tp LEFT JOIN `users` u ON u.id=tp.`userId` WHERE u.id IS NULL;
UPDATE `invitations` i LEFT JOIN `users` u ON u.id=i.`invitedId` SET i.`invitedId`=NULL WHERE i.`invitedId` IS NOT NULL AND u.id IS NULL;
DELETE i FROM `invitations` i LEFT JOIN `users` u ON u.id=i.`inviterId` WHERE u.id IS NULL;
DELETE ci FROM `check_ins` ci LEFT JOIN `users` u ON u.id=ci.`userId` WHERE u.id IS NULL;
DELETE aa FROM `ads_accounts` aa LEFT JOIN `users` u ON u.id=aa.`userId` WHERE u.id IS NULL;
DELETE ac FROM `ads_configurations` ac LEFT JOIN `users` u ON u.id=ac.`userId` WHERE u.id IS NULL;
DELETE ae FROM `ads_executions` ae LEFT JOIN `users` u ON u.id=ae.`userId` WHERE u.id IS NULL;
DELETE ae FROM `ads_executions` ae LEFT JOIN `ads_configurations` ac ON ac.id=ae.`configurationId` WHERE ac.id IS NULL;
DELETE bj FROM `batch_jobs` bj LEFT JOIN `users` u ON u.id=bj.`user_id` WHERE u.id IS NULL;
DELETE bji FROM `batch_job_items` bji LEFT JOIN `batch_jobs` bj ON bj.`id`=bji.`job_id` WHERE bj.`id` IS NULL;
DELETE bjp FROM `batch_job_progress` bjp LEFT JOIN `batch_jobs` bj ON bj.`id`=bjp.`job_id` WHERE bj.`id` IS NULL;
DELETE sch FROM `autoclick_schedules` sch LEFT JOIN `users` u ON u.id=sch.`user_id` WHERE u.id IS NULL;
DELETE pl FROM `autoclick_daily_plans` pl LEFT JOIN `autoclick_schedules` sch ON sch.`id`=pl.`schedule_id` WHERE sch.`id` IS NULL;
DELETE ex FROM `autoclick_executions` ex LEFT JOIN `autoclick_schedules` sch ON sch.`id`=ex.`schedule_id` WHERE sch.`id` IS NULL;
DELETE sn FROM `autoclick_execution_snapshots` sn LEFT JOIN `autoclick_executions` ex ON ex.`id`=sn.`execution_id` WHERE ex.`id` IS NULL;
DELETE ofr FROM `ads_offers` ofr LEFT JOIN `users` u ON u.id=ofr.`user_id` WHERE u.id IS NULL;
DELETE bnd FROM `ads_offer_bindings` bnd LEFT JOIN `ads_offers` ofr ON ofr.`id`=bnd.`offer_id` WHERE ofr.`id` IS NULL;
DELETE bnd FROM `ads_offer_bindings` bnd LEFT JOIN `users` u ON u.id=bnd.`user_id` WHERE u.id IS NULL;
DELETE rot FROM `ads_offer_rotations` rot LEFT JOIN `ads_offer_bindings` bnd ON bnd.`id`=rot.`binding_id` WHERE bnd.`id` IS NULL;
-- config/history tables: remove if user missing
DELETE cch FROM `config_change_history` cch LEFT JOIN `users` u ON u.id=cch.`changedBy` WHERE u.id IS NULL;
DELETE ch FROM `configuration_history` ch LEFT JOIN `users` u ON u.id=ch.`changedBy` WHERE u.id IS NULL;

-- Add foreign keys
ALTER TABLE `accounts` ADD CONSTRAINT `accounts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `user_devices` ADD CONSTRAINT `user_devices_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `environment_variables` 
  ADD CONSTRAINT `env_vars_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `env_vars_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `admin_logs` ADD CONSTRAINT `admin_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `user_activities` ADD CONSTRAINT `user_activities_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `api_usages` ADD CONSTRAINT `api_usages_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `notification_logs`
  ADD CONSTRAINT `notification_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `notification_logs_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `notification_templates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `plan_features` ADD CONSTRAINT `plan_features_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `token_purchases` ADD CONSTRAINT `token_purchases_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `invitations`
  ADD CONSTRAINT `invitations_inviterId_fkey` FOREIGN KEY (`inviterId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `invitations_invitedId_fkey` FOREIGN KEY (`invitedId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `check_ins` ADD CONSTRAINT `check_ins_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ads_accounts` ADD CONSTRAINT `ads_accounts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ads_configurations` ADD CONSTRAINT `ads_configurations_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ads_executions`
  ADD CONSTRAINT `ads_executions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ads_executions_configurationId_fkey` FOREIGN KEY (`configurationId`) REFERENCES `ads_configurations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `batch_jobs` ADD CONSTRAINT `batch_jobs_userId_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `batch_job_items` ADD CONSTRAINT `batch_job_items_jobId_fkey` FOREIGN KEY (`job_id`) REFERENCES `batch_jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `batch_job_progress` ADD CONSTRAINT `batch_job_progress_jobId_fkey` FOREIGN KEY (`job_id`) REFERENCES `batch_jobs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `autoclick_schedules` ADD CONSTRAINT `autoclick_schedules_userId_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `autoclick_daily_plans` ADD CONSTRAINT `autoclick_daily_plans_scheduleId_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `autoclick_schedules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `autoclick_executions` ADD CONSTRAINT `autoclick_executions_scheduleId_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `autoclick_schedules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `autoclick_execution_snapshots` ADD CONSTRAINT `autoclick_snapshots_executionId_fkey` FOREIGN KEY (`execution_id`) REFERENCES `autoclick_executions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ads_offers` ADD CONSTRAINT `ads_offers_userId_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ads_offer_bindings`
  ADD CONSTRAINT `ads_offer_bindings_offerId_fkey` FOREIGN KEY (`offer_id`) REFERENCES `ads_offers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ads_offer_bindings_userId_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ads_offer_rotations` ADD CONSTRAINT `ads_offer_rotations_bindingId_fkey` FOREIGN KEY (`binding_id`) REFERENCES `ads_offer_bindings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

