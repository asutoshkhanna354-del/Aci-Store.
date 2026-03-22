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
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_proof_data TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_proof_mime VARCHAR(100);
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='orders' AND column_name='payment_proof_data' AND data_type='bytea'
  ) THEN
    ALTER TABLE orders ALTER COLUMN payment_proof_data TYPE TEXT USING NULL;
  END IF;
END $$;

INSERT INTO settings (key, value) SELECT 'store_name', 'FF Panel' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'store_name');
INSERT INTO settings (key, value) SELECT 'upi_id', 'yourupi@bank' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'upi_id');
INSERT INTO settings (key, value) SELECT 'store_description', 'Premium FF Panels for iOS & Android' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'store_description');
INSERT INTO settings (key, value) SELECT 'announcement', '' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'announcement');
INSERT INTO settings (key, value) SELECT 'telegram_support', '' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'telegram_support');
INSERT INTO settings (key, value) SELECT 'payment_method_upi', 'true' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'payment_method_upi');
INSERT INTO settings (key, value) SELECT 'payment_method_crypto', 'true' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'payment_method_crypto');
INSERT INTO settings (key, value) SELECT 'crypto_btc_address', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'crypto_btc_address');
INSERT INTO settings (key, value) SELECT 'crypto_usdt_trc20_address', 'TExampleUSDTAddressTRC20here' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'crypto_usdt_trc20_address');
INSERT INTO settings (key, value) SELECT 'crypto_usdt_erc20_address', '0xExampleUSDTAddressERC20here' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'crypto_usdt_erc20_address');
INSERT INTO settings (key, value) SELECT 'crypto_usdt_bep20_address', '0xExampleUSDTAddressBEP20here' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'crypto_usdt_bep20_address');
INSERT INTO settings (key, value) SELECT 'paypal_id', '' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'paypal_id');
INSERT INTO settings (key, value) SELECT 'payment_method_paypal', 'false' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'payment_method_paypal');
INSERT INTO settings (key, value) SELECT 'bkash_number', '' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'bkash_number');
INSERT INTO settings (key, value) SELECT 'nagad_number', '' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'nagad_number');
INSERT INTO settings (key, value) SELECT 'payment_method_bkash', 'false' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'payment_method_bkash');
INSERT INTO settings (key, value) SELECT 'payment_method_nagad', 'false' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'payment_method_nagad');
INSERT INTO settings (key, value) SELECT 'particle_effect', 'none' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'particle_effect');
INSERT INTO settings (key, value) SELECT 'banner_data', '' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'banner_data');
INSERT INTO settings (key, value) SELECT 'telegram_reseller_link', '' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'telegram_reseller_link');
INSERT INTO settings (key, value) SELECT 'whatsapp_support', '' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'whatsapp_support');

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
  amount_usd DECIMAL(10,2) NOT NULL,
  price_usd DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reseller_packages_amount_usd_key'
    AND conrelid = 'reseller_packages'::regclass
  ) THEN
    ALTER TABLE reseller_packages ADD CONSTRAINT reseller_packages_amount_usd_key UNIQUE (amount_usd);
  END IF;
END $$;

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

INSERT INTO reseller_packages (name, amount_usd, price_usd, sort_order) SELECT '$10 Balance', 10, 10, 1 WHERE NOT EXISTS (SELECT 1 FROM reseller_packages WHERE amount_usd = 10);
INSERT INTO reseller_packages (name, amount_usd, price_usd, sort_order) SELECT '$25 Balance', 25, 25, 2 WHERE NOT EXISTS (SELECT 1 FROM reseller_packages WHERE amount_usd = 25);
INSERT INTO reseller_packages (name, amount_usd, price_usd, sort_order) SELECT '$50 Balance', 50, 50, 3 WHERE NOT EXISTS (SELECT 1 FROM reseller_packages WHERE amount_usd = 50);
INSERT INTO reseller_packages (name, amount_usd, price_usd, sort_order) SELECT '$100 Balance', 100, 100, 4 WHERE NOT EXISTS (SELECT 1 FROM reseller_packages WHERE amount_usd = 100);
INSERT INTO reseller_packages (name, amount_usd, price_usd, sort_order) SELECT '$200 Balance', 200, 200, 5 WHERE NOT EXISTS (SELECT 1 FROM reseller_packages WHERE amount_usd = 200);
INSERT INTO reseller_packages (name, amount_usd, price_usd, sort_order) SELECT '$500 Balance', 500, 500, 6 WHERE NOT EXISTS (SELECT 1 FROM reseller_packages WHERE amount_usd = 500);
INSERT INTO reseller_packages (name, amount_usd, price_usd, sort_order) SELECT '$1000 Balance', 1000, 1000, 7 WHERE NOT EXISTS (SELECT 1 FROM reseller_packages WHERE amount_usd = 1000);

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

INSERT INTO settings (key, value) SELECT 'notifications_enabled', 'true' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'notifications_enabled');
INSERT INTO settings (key, value) SELECT 'vapid_public_key', 'BD0fVGhy6WbLCo4L0oWXSctE9EZgnAIoLQv0JVA7qtm1FBnm4adIQl8w54V5I9KJvCL7dYGvkLAmUwIt0zVT6ls' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'vapid_public_key');
INSERT INTO settings (key, value) SELECT 'vapid_private_key', 'UxMa0lUyX961FDw5YB-PSFemrv5dTUc8ciUHYc2jhmE' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'vapid_private_key');
INSERT INTO settings (key, value) SELECT 'reseller_key_price_1day', '3' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'reseller_key_price_1day');
INSERT INTO settings (key, value) SELECT 'reseller_key_price_3day', '7' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'reseller_key_price_3day');
INSERT INTO settings (key, value) SELECT 'reseller_key_price_7day', '12' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'reseller_key_price_7day');
INSERT INTO settings (key, value) SELECT 'reseller_key_price_14day', '20' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'reseller_key_price_14day');
INSERT INTO settings (key, value) SELECT 'reseller_key_price_30day', '35' WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'reseller_key_price_30day');

UPDATE settings SET value = (SELECT value FROM settings WHERE key = 'payment_method_bd') WHERE key IN ('payment_method_bkash', 'payment_method_nagad') AND EXISTS (SELECT 1 FROM settings WHERE key = 'payment_method_bd' AND value = 'true') AND value = 'false';
DELETE FROM settings WHERE key = 'payment_method_bd';
