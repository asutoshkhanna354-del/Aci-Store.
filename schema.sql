CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  telegram_username VARCHAR(255) DEFAULT '',
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sections (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS panels (
  id SERIAL PRIMARY KEY,
  section_id INT REFERENCES sections(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  platform VARCHAR(50) DEFAULT 'both',
  price_1day DECIMAL(10,2) DEFAULT 0,
  price_7day DECIMAL(10,2) DEFAULT 0,
  price_30day DECIMAL(10,2) DEFAULT 0,
  price_60day DECIMAL(10,2) DEFAULT 0,
  is_in_stock BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  features TEXT DEFAULT '',
  reseller_price_1day DECIMAL(10,2) DEFAULT 0,
  reseller_price_7day DECIMAL(10,2) DEFAULT 0,
  reseller_price_30day DECIMAL(10,2) DEFAULT 0,
  reseller_price_60day DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE panels ADD COLUMN IF NOT EXISTS reseller_price_1day DECIMAL(10,2) DEFAULT 0;
ALTER TABLE panels ADD COLUMN IF NOT EXISTS reseller_price_7day DECIMAL(10,2) DEFAULT 0;
ALTER TABLE panels ADD COLUMN IF NOT EXISTS reseller_price_30day DECIMAL(10,2) DEFAULT 0;
ALTER TABLE panels ADD COLUMN IF NOT EXISTS reseller_price_60day DECIMAL(10,2) DEFAULT 0;
ALTER TABLE panels ADD COLUMN IF NOT EXISTS custom_prices JSONB DEFAULT '{}';
ALTER TABLE panels ADD COLUMN IF NOT EXISTS hidden_durations JSONB DEFAULT '{}';

CREATE TABLE IF NOT EXISTS promo_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  discount_percent INT DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  min_order DECIMAL(10,2) DEFAULT 0,
  max_uses INT DEFAULT 0,
  used_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  panel_id INT REFERENCES panels(id) ON DELETE SET NULL,
  panel_name VARCHAR(255) NOT NULL,
  duration VARCHAR(50) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  final_price DECIMAL(10,2) NOT NULL,
  promo_code VARCHAR(100) DEFAULT '',
  utr_number VARCHAR(255) DEFAULT '',
  payment_method VARCHAR(50) DEFAULT 'upi',
  status VARCHAR(50) DEFAULT 'pending_payment',
  customer_username VARCHAR(255) DEFAULT '',
  customer_telegram VARCHAR(255) DEFAULT '',
  customer_email VARCHAR(255) DEFAULT '',
  key_delivered TEXT DEFAULT '',
  admin_notes TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_files TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_proof_image TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_proof_data BYTEA;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_proof_mime VARCHAR(100);

INSERT INTO settings (key, value) VALUES ('store_name', 'FF Panel') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('upi_id', 'yourupi@bank') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('store_description', 'Premium FF Panels for iOS & Android') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('announcement', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('telegram_support', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('payment_method_upi', 'true') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('payment_method_crypto', 'true') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('crypto_btc_address', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('crypto_usdt_trc20_address', 'TExampleUSDTAddressTRC20here') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('crypto_usdt_erc20_address', '0xExampleUSDTAddressERC20here') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('crypto_usdt_bep20_address', '0xExampleUSDTAddressBEP20here') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('paypal_id', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('payment_method_paypal', 'false') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('bkash_number', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('nagad_number', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('payment_method_bkash', 'false') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('payment_method_nagad', 'false') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('particle_effect', 'none') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('banner_data', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('telegram_reseller_link', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('whatsapp_support', '') ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS panel_images (
  id SERIAL PRIMARY KEY,
  panel_id INT REFERENCES panels(id) ON DELETE CASCADE,
  filename VARCHAR(500) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resellers (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) DEFAULT '',
  status VARCHAR(20) DEFAULT 'active',
  wallet_balance DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reseller_packages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  amount_usd DECIMAL(10,2) NOT NULL UNIQUE,
  price_usd DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reseller_topups (
  id SERIAL PRIMARY KEY,
  reseller_id INT REFERENCES resellers(id) ON DELETE CASCADE,
  package_id INT REFERENCES reseller_packages(id) ON DELETE SET NULL,
  amount_usd DECIMAL(10,2) NOT NULL,
  price_usd DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'upi',
  utr_number VARCHAR(255) DEFAULT '',
  status VARCHAR(50) DEFAULT 'pending_payment',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reseller_key_pool (
  id SERIAL PRIMARY KEY,
  panel_id INT REFERENCES panels(id) ON DELETE CASCADE,
  duration_days INT NOT NULL,
  key_value TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'available',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reseller_key_orders (
  id SERIAL PRIMARY KEY,
  reseller_id INT REFERENCES resellers(id) ON DELETE CASCADE,
  panel_id INT REFERENCES panels(id) ON DELETE SET NULL,
  duration_days INT NOT NULL,
  price_usd DECIMAL(10,2) NOT NULL,
  key_id INT REFERENCES reseller_key_pool(id) ON DELETE SET NULL,
  key_value TEXT DEFAULT '',
  status VARCHAR(20) DEFAULT 'delivered',
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE reseller_key_pool ADD COLUMN IF NOT EXISTS panel_id INT REFERENCES panels(id) ON DELETE CASCADE;
ALTER TABLE reseller_key_orders ADD COLUMN IF NOT EXISTS panel_id INT REFERENCES panels(id) ON DELETE SET NULL;

ALTER TABLE panel_images ADD COLUMN IF NOT EXISTS media_type VARCHAR(10) DEFAULT 'image';
ALTER TABLE panel_images ADD COLUMN IF NOT EXISTS file_data BYTEA;
ALTER TABLE panel_images ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);

CREATE TABLE IF NOT EXISTS customer_key_pool (
  id SERIAL PRIMARY KEY,
  panel_id INT REFERENCES panels(id) ON DELETE CASCADE,
  duration_days INT NOT NULL,
  key_value TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'available',
  assigned_order_id INT REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS panel_files (
  id SERIAL PRIMARY KEY,
  panel_id INT REFERENCES panels(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  version VARCHAR(50) DEFAULT '1.0',
  file_path VARCHAR(500) NOT NULL,
  file_size VARCHAR(50) DEFAULT '',
  thumbnail VARCHAR(500) DEFAULT '',
  download_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE panel_files ADD COLUMN IF NOT EXISTS file_data BYTEA;
ALTER TABLE panel_files ADD COLUMN IF NOT EXISTS file_mime VARCHAR(100);
ALTER TABLE panel_files ADD COLUMN IF NOT EXISTS thumb_data BYTEA;
ALTER TABLE panel_files ADD COLUMN IF NOT EXISTS thumb_mime VARCHAR(100);
ALTER TABLE panel_files ADD COLUMN IF NOT EXISTS original_filename VARCHAR(500) DEFAULT '';

INSERT INTO reseller_packages (name, amount_usd, price_usd, sort_order) VALUES ('$10 Balance', 10, 10, 1) ON CONFLICT (amount_usd) DO NOTHING;
INSERT INTO reseller_packages (name, amount_usd, price_usd, sort_order) VALUES ('$25 Balance', 25, 25, 2) ON CONFLICT (amount_usd) DO NOTHING;
INSERT INTO reseller_packages (name, amount_usd, price_usd, sort_order) VALUES ('$50 Balance', 50, 50, 3) ON CONFLICT (amount_usd) DO NOTHING;
INSERT INTO reseller_packages (name, amount_usd, price_usd, sort_order) VALUES ('$100 Balance', 100, 100, 4) ON CONFLICT (amount_usd) DO NOTHING;
INSERT INTO reseller_packages (name, amount_usd, price_usd, sort_order) VALUES ('$200 Balance', 200, 200, 5) ON CONFLICT (amount_usd) DO NOTHING;
INSERT INTO reseller_packages (name, amount_usd, price_usd, sort_order) VALUES ('$500 Balance', 500, 500, 6) ON CONFLICT (amount_usd) DO NOTHING;
INSERT INTO reseller_packages (name, amount_usd, price_usd, sort_order) VALUES ('$1000 Balance', 1000, 1000, 7) ON CONFLICT (amount_usd) DO NOTHING;

CREATE TABLE IF NOT EXISTS admin_notifications (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT DEFAULT '',
  order_id INT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(endpoint)
);

INSERT INTO settings (key, value) VALUES ('notifications_enabled', 'true') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('vapid_public_key', 'BD0fVGhy6WbLCo4L0oWXSctE9EZgnAIoLQv0JVA7qtm1FBnm4adIQl8w54V5I9KJvCL7dYGvkLAmUwIt0zVT6ls') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('vapid_private_key', 'UxMa0lUyX961FDw5YB-PSFemrv5dTUc8ciUHYc2jhmE') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('reseller_key_price_1day', '3') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('reseller_key_price_3day', '7') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('reseller_key_price_7day', '12') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('reseller_key_price_14day', '20') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('reseller_key_price_30day', '35') ON CONFLICT (key) DO NOTHING;

UPDATE settings SET value = (SELECT value FROM settings WHERE key = 'payment_method_bd') WHERE key IN ('payment_method_bkash', 'payment_method_nagad') AND EXISTS (SELECT 1 FROM settings WHERE key = 'payment_method_bd' AND value = 'true') AND value = 'false';
DELETE FROM settings WHERE key = 'payment_method_bd';
INSERT INTO settings (key, value) VALUES ('crypto_usdt_bep20_address', '0xExampleUSDTAddressBEP20here') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('paypal_id', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('payment_method_paypal', 'false') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('bkash_number', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('nagad_number', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('payment_method_bkash', 'false') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('payment_method_nagad', 'false') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('particle_effect', 'none') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('banner_data', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('telegram_reseller_link', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('whatsapp_support', '') ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS panel_images (
  id SERIAL PRIMARY KEY,
  panel_id INT REFERENCES panels(id) ON DELETE CASCADE,
  filename VARCHAR(500) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resellers (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) DEFAULT '',
  status VARCHAR(20) DEFAULT 'active',
  wallet_balance DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reseller_packages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  amount_usd DECIMAL(10,2) NOT NULL UNIQUE,
  price_usd DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reseller_topups (
  id SERIAL PRIMARY KEY,
  reseller_id INT REFERENCES resellers(id) ON DELETE CASCADE,
  package_id INT REFERENCES reseller_packages(id) ON DELETE SET NULL,
  amount_usd DECIMAL(10,2) NOT NULL,
  price_usd DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'upi',
  utr_number VARCHAR(255) DEFAULT '',
  status VARCHAR(50) DEFAULT 'pending_payment',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reseller_key_pool (
  id SERIAL PRIMARY KEY,
  panel_id INT REFERENCES panels(id) ON DELETE CASCADE,
  duration_days INT NOT NULL,
  key_value TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'available',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reseller_key_orders (
  id SERIAL PRIMARY KEY,
  reseller_id INT REFERENCES resellers(id) ON DELETE CASCADE,
  panel_id INT REFERENCES panels(id) ON DELETE SET NULL,
  duration_days INT NOT NULL,
  price_usd DECIMAL(10,2) NOT NULL,
  key_id INT REFERENCES reseller_key_pool(id) ON DELETE SET NULL,
  key_value TEXT DEFAULT '',
  status VARCHAR(20) DEFAULT 'delivered',
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE reseller_key_pool ADD COLUMN IF NOT EXISTS panel_id INT REFERENCES panels(id) ON DELETE CASCADE;
ALTER TABLE reseller_key_orders ADD COLUMN IF NOT EXISTS panel_id INT REFERENCES panels(id) ON DELETE SET NULL;

ALTER TABLE panel_images ADD COLUMN IF NOT EXISTS media_type VARCHAR(10) DEFAULT 'image';
ALTER TABLE panel_images ADD COLUMN IF NOT EXISTS file_data BYTEA;
ALTER TABLE panel_images ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);

CREATE TABLE IF NOT EXISTS customer_key_pool (
  id SERIAL PRIMARY KEY,
  panel_id INT REFERENCES panels(id) ON DELETE CASCADE,
  duration_days INT NOT NULL,
  key_value TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'available',
  assigned_order_id INT REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS panel_files (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  version VARCHAR(50) DEFAULT '1.0',
  file_path TEXT NOT NULL,
  file_size VARCHAR(50) DEFAULT '',
  thumbnail TEXT DEFAULT '',
  original_filename VARCHAR(500) DEFAULT '',
  update_date VARCHAR(50) DEFAULT '',
  download_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
-- For existing tables: add missing columns if upgrading from older schema
ALTER TABLE panel_files ADD COLUMN IF NOT EXISTS original_filename VARCHAR(500) DEFAULT '';
ALTER TABLE panel_files ADD COLUMN IF NOT EXISTS update_date VARCHAR(50) DEFAULT '';

INSERT INTO reseller_packages (name, amount_usd, price_usd, sort_order) VALUES ('$10 Balance', 10, 10, 1) ON CONFLICT (amount_usd) DO NOTHING;
INSERT INTO reseller_packages (name, amount_usd, price_usd, sort_order) VALUES ('$25 Balance', 25, 25, 2) ON CONFLICT (amount_usd) DO NOTHING;
INSERT INTO reseller_packages (name, amount_usd, price_usd, sort_order) VALUES ('$50 Balance', 50, 50, 3) ON CONFLICT (amount_usd) DO NOTHING;
INSERT INTO reseller_packages (name, amount_usd, price_usd, sort_order) VALUES ('$100 Balance', 100, 100, 4) ON CONFLICT (amount_usd) DO NOTHING;
INSERT INTO reseller_packages (name, amount_usd, price_usd, sort_order) VALUES ('$200 Balance', 200, 200, 5) ON CONFLICT (amount_usd) DO NOTHING;
INSERT INTO reseller_packages (name, amount_usd, price_usd, sort_order) VALUES ('$500 Balance', 500, 500, 6) ON CONFLICT (amount_usd) DO NOTHING;
INSERT INTO reseller_packages (name, amount_usd, price_usd, sort_order) VALUES ('$1000 Balance', 1000, 1000, 7) ON CONFLICT (amount_usd) DO NOTHING;

CREATE TABLE IF NOT EXISTS admin_notifications (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT DEFAULT '',
  order_id INT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(endpoint)
);

INSERT INTO settings (key, value) VALUES ('notifications_enabled', 'true') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('vapid_public_key', 'BD0fVGhy6WbLCo4L0oWXSctE9EZgnAIoLQv0JVA7qtm1FBnm4adIQl8w54V5I9KJvCL7dYGvkLAmUwIt0zVT6ls') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('vapid_private_key', 'UxMa0lUyX961FDw5YB-PSFemrv5dTUc8ciUHYc2jhmE') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('reseller_key_price_1day', '3') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('reseller_key_price_3day', '7') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('reseller_key_price_7day', '12') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('reseller_key_price_14day', '20') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('reseller_key_price_30day', '35') ON CONFLICT (key) DO NOTHING;

UPDATE settings SET value = (SELECT value FROM settings WHERE key = 'payment_method_bd') WHERE key IN ('payment_method_bkash', 'payment_method_nagad') AND EXISTS (SELECT 1 FROM settings WHERE key = 'payment_method_bd' AND value = 'true') AND value = 'false';
DELETE FROM settings WHERE key = 'payment_method_bd';
