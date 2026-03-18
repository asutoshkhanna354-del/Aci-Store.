const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { generateResellerToken, resellerMiddleware } = require('../auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'All fields required' });

    const result = await pool.query('SELECT * FROM resellers WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid credentials' });

    const reseller = result.rows[0];
    if (reseller.status !== 'active') return res.status(403).json({ error: 'Account is suspended' });

    const valid = await bcrypt.compare(password, reseller.password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    const token = generateResellerToken(reseller);
    res.json({
      reseller: { id: reseller.id, username: reseller.username, display_name: reseller.display_name, wallet_balance: reseller.wallet_balance },
      token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', resellerMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, display_name, wallet_balance, status, created_at FROM resellers WHERE id = $1', [req.reseller.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reseller not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/packages', resellerMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reseller_packages WHERE is_active = true ORDER BY sort_order, id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/topup', resellerMiddleware, async (req, res) => {
  try {
    const { package_id, payment_method, utr_number } = req.body;
    if (!package_id || !payment_method || !utr_number) return res.status(400).json({ error: 'All fields required' });

    const pkg = await pool.query('SELECT * FROM reseller_packages WHERE id = $1 AND is_active = true', [package_id]);
    if (pkg.rows.length === 0) return res.status(400).json({ error: 'Package not found' });

    const p = pkg.rows[0];
    const result = await pool.query(
      'INSERT INTO reseller_topups (reseller_id, package_id, amount_usd, price_usd, payment_method, utr_number, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [req.reseller.id, package_id, p.amount_usd, p.price_usd, payment_method, utr_number, 'pending_verification']
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/topups', resellerMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT t.*, p.name as package_name FROM reseller_topups t LEFT JOIN reseller_packages p ON t.package_id = p.id WHERE t.reseller_id = $1 ORDER BY t.created_at DESC',
      [req.reseller.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/key-prices', resellerMiddleware, async (req, res) => {
  try {
    const result = await pool.query("SELECT key, value FROM settings WHERE key LIKE 'reseller_key_price_%'");
    const prices = {};
    result.rows.forEach(r => {
      const days = r.key.replace('reseller_key_price_', '').replace('day', '');
      prices[days] = parseFloat(r.value);
    });
    res.json(prices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/key-availability', resellerMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT duration_days, COUNT(*) as count FROM reseller_key_pool WHERE status = 'available' GROUP BY duration_days ORDER BY duration_days"
    );
    const availability = {};
    result.rows.forEach(r => { availability[r.duration_days] = parseInt(r.count); });
    res.json(availability);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/panels', resellerMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, s.name as section_name,
      (SELECT COUNT(*) FROM reseller_key_pool rkp WHERE rkp.panel_id = p.id AND rkp.status = 'available') as key_count
      FROM panels p
      LEFT JOIN sections s ON p.section_id = s.id
      WHERE p.is_active = true AND s.is_active = true
      ORDER BY s.sort_order, p.sort_order, p.id
    `);
    const avail = await pool.query(
      "SELECT panel_id, duration_days, COUNT(*) as count FROM reseller_key_pool WHERE status = 'available' GROUP BY panel_id, duration_days"
    );
    const availMap = {};
    avail.rows.forEach(r => {
      if (!availMap[r.panel_id]) availMap[r.panel_id] = {};
      availMap[r.panel_id][r.duration_days] = parseInt(r.count);
    });
    const panels = result.rows.map(p => ({ ...p, key_availability: availMap[p.id] || {} }));
    res.json(panels);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/buy-key', resellerMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { panel_id, duration_days } = req.body;
    if (!panel_id || !duration_days) return res.status(400).json({ error: 'Panel and duration required' });

    await client.query('BEGIN');

    const panelResult = await client.query('SELECT * FROM panels WHERE id = $1', [panel_id]);
    if (panelResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Panel not found' });
    }
    const panel = panelResult.rows[0];

    const fixedDurations = [1, 7, 30, 60];
    let price = 0;
    if (fixedDurations.includes(parseInt(duration_days))) {
      const resellerPriceField = `reseller_price_${duration_days}day`;
      const customerPriceField = `price_${duration_days}day`;
      const resellerPrice = parseFloat(panel[resellerPriceField]);
      price = (resellerPrice && resellerPrice > 0) ? resellerPrice : parseFloat(panel[customerPriceField]);
    } else {
      const customPrices = panel.custom_prices || {};
      const cp = customPrices[String(duration_days)];
      if (cp) {
        const rp = parseFloat(cp.reseller_price);
        price = (rp && rp > 0) ? rp : parseFloat(cp.price);
      }
    }
    if (!price || price <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid duration for this panel' });
    }

    const resellerResult = await client.query('SELECT wallet_balance FROM resellers WHERE id = $1 FOR UPDATE', [req.reseller.id]);
    const balance = parseFloat(resellerResult.rows[0].wallet_balance);
    if (balance < price) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    const keyResult = await client.query(
      "SELECT id, key_value FROM reseller_key_pool WHERE panel_id = $1 AND duration_days = $2 AND status = 'available' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED",
      [panel_id, parseInt(duration_days)]
    );
    if (keyResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No keys available for this panel and duration' });
    }

    const key = keyResult.rows[0];

    await client.query("UPDATE reseller_key_pool SET status = 'sold' WHERE id = $1", [key.id]);
    await client.query('UPDATE resellers SET wallet_balance = wallet_balance - $1 WHERE id = $2', [price, req.reseller.id]);

    const orderResult = await client.query(
      'INSERT INTO reseller_key_orders (reseller_id, panel_id, duration_days, price_usd, key_id, key_value, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [req.reseller.id, panel_id, duration_days, price, key.id, key.key_value, 'delivered']
    );

    await client.query('COMMIT');

    const updatedReseller = await pool.query('SELECT wallet_balance FROM resellers WHERE id = $1', [req.reseller.id]);

    res.json({
      order: orderResult.rows[0],
      new_balance: parseFloat(updatedReseller.rows[0].wallet_balance)
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.get('/key-orders', resellerMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM reseller_key_orders WHERE reseller_id = $1 ORDER BY created_at DESC',
      [req.reseller.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/payment-info', resellerMiddleware, async (req, res) => {
  try {
    const result = await pool.query("SELECT key, value FROM settings WHERE key IN ('upi_id','payment_method_upi','payment_method_crypto','crypto_btc_address','crypto_usdt_trc20_address','crypto_usdt_erc20_address','crypto_usdt_bep20_address','payment_method_paypal','paypal_id','payment_method_bd','bkash_number','nagad_number')");
    const info = {};
    result.rows.forEach(r => { info[r.key] = r.value; });
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
