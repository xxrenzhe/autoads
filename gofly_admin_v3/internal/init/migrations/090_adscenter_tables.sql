-- AdsCenter v2 minimal tables: offers/bindings/rotations

CREATE TABLE IF NOT EXISTS ads_offers (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  offer_url VARCHAR(1000) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_ads_offers_user (user_id),
  INDEX idx_ads_offers_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ads_offer_bindings (
  id VARCHAR(36) PRIMARY KEY,
  offer_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  account_id VARCHAR(255) NOT NULL,
  rotation_frequency VARCHAR(20) NOT NULL,
  rotation_at VARCHAR(5) NULL,
  unique_window_days INT NOT NULL DEFAULT 90,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_ads_bindings_offer (offer_id),
  INDEX idx_ads_bindings_user (user_id),
  INDEX idx_ads_bindings_account (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ads_offer_rotations (
  id VARCHAR(36) PRIMARY KEY,
  binding_id VARCHAR(36) NOT NULL,
  account_id VARCHAR(255) NOT NULL,
  rotated_at DATETIME NOT NULL,
  final_url VARCHAR(1000) NOT NULL,
  final_url_suffix VARCHAR(1000) NOT NULL,
  final_hash VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL,
  message TEXT,
  INDEX idx_ads_rotations_binding (binding_id),
  INDEX idx_ads_rotations_account (account_id),
  INDEX idx_ads_rotations_hash (final_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

