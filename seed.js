const pool = require('./db');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function seed() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);

  const hash = await bcrypt.hash('shariyan988', 10);
  const adminExists = await pool.query("SELECT id FROM users WHERE username = 'Shariyan1'");
  if (adminExists.rows.length === 0) {
    const oldAdmin = await pool.query("SELECT id FROM users WHERE username = 'admin'");
    if (oldAdmin.rows.length > 0) {
      await pool.query(
        "UPDATE users SET username = 'Shariyan1', password = $1, is_admin = TRUE WHERE username = 'admin'",
        [hash]
      );
    } else {
      await pool.query(
        "INSERT INTO users (username, email, password, is_admin) VALUES ($1, $2, $3, $4)",
        ['Shariyan1', 'admin@ffpanel.com', hash, true]
      );
    }
  } else {
    await pool.query(
      "UPDATE users SET password = $1, is_admin = TRUE WHERE username = 'Shariyan1'",
      [hash]
    );
  }

  const sectionsExist = await pool.query("SELECT id FROM sections LIMIT 1");
  if (sectionsExist.rows.length === 0) {
    const sections = [
      { name: 'Headshot Panels', description: 'Auto headshot panels for maximum accuracy', sort_order: 1 },
      { name: 'Magic Bullet Panels', description: 'Magic bullet panels with advanced features', sort_order: 2 },
      { name: 'ESP Panels', description: 'ESP panels with wallhack and player detection', sort_order: 3 },
      { name: 'Fluorite Keys', description: 'FF Fluorite activation keys for all durations', sort_order: 4 },
    ];

    for (const s of sections) {
      await pool.query(
        "INSERT INTO sections (name, description, sort_order) VALUES ($1, $2, $3)",
        [s.name, s.description, s.sort_order]
      );
    }

    const sectionRows = await pool.query("SELECT id, name FROM sections ORDER BY sort_order");
    const sectionMap = {};
    sectionRows.rows.forEach(r => { sectionMap[r.name] = r.id; });

    const panels = [
      { section: 'Headshot Panels', name: 'Head Panel V1 - Basic', description: 'Basic headshot panel with auto-aim assist. Works on both iOS and Android.', platform: 'both', p1: 1, p7: 3, p30: 8, p60: 12, features: 'Auto Headshot,Aim Assist,Anti-Ban Protection,Easy Setup' },
      { section: 'Headshot Panels', name: 'Head Panel V2 - Pro', description: 'Advanced headshot panel with enhanced accuracy and speed.', platform: 'both', p1: 1.5, p7: 5, p30: 12, p60: 22, features: 'Pro Headshot,Speed Boost,Custom Sensitivity,Anti-Ban V2' },
      { section: 'Magic Bullet Panels', name: 'Magic Bullet Panel - Standard', description: 'Standard magic bullet panel with auto tracking.', platform: 'both', p1: 1, p7: 3.5, p30: 9, p60: 15, features: 'Magic Bullet,Auto Track,Smooth Aim,Anti-Detection' },
      { section: 'Magic Bullet Panels', name: 'Magic Bullet Panel - Premium', description: 'Premium magic bullet with advanced tracking and custom settings.', platform: 'both', p1: 1.5, p7: 5, p30: 15, p60: 25, features: 'Premium Bullet,Advanced Track,Custom Config,Priority Support' },
      { section: 'ESP Panels', name: 'ESP Panel - Lite', description: 'Lightweight ESP panel with basic player detection.', platform: 'both', p1: 1, p7: 2, p30: 6, p60: 10, features: 'Player ESP,Box ESP,Distance Show,Low Resource' },
      { section: 'ESP Panels', name: 'ESP Panel - Full', description: 'Full ESP panel with all detection features included.', platform: 'both', p1: 1.5, p7: 5, p30: 12, p60: 20, features: 'Full ESP,Aimbot ESP,Loot ESP,Vehicle ESP,Health Bar' },
      { section: 'Fluorite Keys', name: 'Fluorite Key - Standard', description: 'Standard Fluorite activation key for FF panels.', platform: 'both', p1: 1, p7: 2, p30: 5, p60: 8, features: 'Instant Activation,All Panels Support,Auto Update,24/7 Uptime' },
      { section: 'Fluorite Keys', name: 'Fluorite Key - Premium', description: 'Premium Fluorite key with priority access and extra features.', platform: 'both', p1: 1, p7: 3, p30: 7, p60: 12, features: 'Priority Access,Premium Features,Fast Updates,VIP Support' },
    ];

    for (const p of panels) {
      await pool.query(
        `INSERT INTO panels (section_id, name, description, platform, price_1day, price_7day, price_30day, price_60day, features)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [sectionMap[p.section], p.name, p.description, p.platform, p.p1, p.p7, p.p30, p.p60, p.features]
      );
    }

    await pool.query(
      "INSERT INTO promo_codes (code, discount_percent, max_uses, is_active) VALUES ($1, $2, $3, $4)",
      ['WELCOME10', 10, 100, true]
    );
  }

  console.log('Database seeded successfully');
}

seed().catch(console.error);
