-- Ensure unique package names for upsert-friendly seeding
ALTER TABLE `token_packages`
  ADD UNIQUE INDEX `uk_token_packages_name` (`name`);

