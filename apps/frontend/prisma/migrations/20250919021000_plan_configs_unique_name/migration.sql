-- Ensure unique names for plan_configs to allow upsert by name
ALTER TABLE `plan_configs`
  ADD UNIQUE INDEX `uk_plan_configs_name` (`name`);

