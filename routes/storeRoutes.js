const express = require('express');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('../db');
const { authMiddleware } = require('../auth');

let sendPushToAdmins = () => Promise.resolve();
try { sendPushToAdmins = require('../pushNotify').sendPushToAdmins || sendPushToAdmins; } catch (_) {}
const router = express.Router();
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

const proofStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `proof_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const proofUpload = multer({
  storage: proofStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  }
});

router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/sections', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sections WHERE is_active = true ORDER BY sort_order, id');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/panels', async (req, res) => {
  try {
    const { section_id } = req.query;
    let query = `SELECT p.*, s.name as section_name FROM panels p
      LEFT JOIN sections s ON p.section_id = s.id
      WHERE p.is_active = true AND s.is_active = true ORDER BY s.sort_order, p.sort_order, p.id`;
    let params = [];
    if (section_id) {
      query = `SELECT p.*, s.name as section_name FROM panels p
        LEFT JOIN sections s ON p.section_id = s.id
        WHERE p.is_active = true AND s.is_active = true AND p.section_id = $1
        ORDER BY p.sort_order, p.id`;
      params = [section_id];
    }
    const result = await pool.query(query, params);
    const panelIds = result.rows.map(p => p.id);
    let imagesMap = {};
    if (panelIds.length > 0) {
      const imgResult = await pool.query('SELECT id, panel_id, filename, original_name, sort_order, media_type, created_at FROM panel_images WHERE panel_id = ANY($1) ORDER BY sort_order, id', [panelIds]);
      imgResult.rows.forEach(img => {
        if (!imagesMap[img.panel_id]) imagesMap[img.panel_id] = [];
        imagesMap[img.panel_id].push(img);
      });
    }
    const panelIds2 = result.rows.map(p => p.id);
    let stockMap = {};
    if (panelIds2.length > 0) {
      const stockResult = await pool.query(
        "SELECT panel_id, duration_days, COUNT(*) as count FROM customer_key_pool WHERE status = 'available' GROUP BY panel_id, duration_days"
      );
      stockResult.rows.forEach(r => {
        if (!stockMap[r.panel_id]) stockMap[r.panel_id] = {};
        stockMap[r.panel_id][r.duration_days] = true;
      });
    }
    const panels = result.rows.map(p => ({ ...p, images: imagesMap[p.id] || [], stock_by_duration: stockMap[p.id] || {} }));
    res.json(panels);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/panels/:id', async (req, res) => {
  try {
    const result = await pool.query(`SELECT p.*, s.name as section_name FROM panels p LEFT JOIN sections s ON p.section_id = s.id WHERE p.id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Panel not found' });
    const images = await pool.query('SELECT id, panel_id, filename, original_name, sort_order, media_type, created_at FROM panel_images WHERE panel_id = $1 ORDER BY sort_order, id', [req.params.id]);
    const stockResult = await pool.query(
      "SELECT duration_days, COUNT(*) as count FROM customer_key_pool WHERE panel_id = $1 AND status = 'available' GROUP BY duration_days",
      [req.params.id]
    );
    const stockMap = {};
    stockResult.rows.forEach(r => { stockMap[r.duration_days] = true; });
    res.json({ ...result.rows[0], images: images.rows, stock_by_duration: stockMap });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/apply-promo', authMiddleware, async (req, res) => {
  try {
    const { code, amount } = req.body;
    const result = await pool.query('SELECT * FROM promo_codes WHERE code = $1 AND is_active = true', [code.toUpperCase()]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid promo code' });

    const promo = result.rows[0];
    if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) return res.status(400).json({ error: 'Promo code expired' });
    if (promo.expires_at && new Date(promo.expires_at) < new Date()) return res.status(400).json({ error: 'Promo code expired' });
    if (promo.min_order > 0 && amount < promo.min_order) return res.status(400).json({ error: `Minimum order ₹${promo.min_order} required` });

    let discount = 0;
    if (promo.discount_percent > 0) discount = (amount * promo.discount_percent) / 100;
    if (promo.discount_amount > 0) discount = parseFloat(promo.discount_amount);
    discount = Math.min(discount, amount);

    res.json({ discount, promo_code: promo.code, discount_percent: promo.discount_percent, discount_amount: promo.discount_amount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/qr/:upiId/:amount', async (req, res) => {
  try {
    const { upiId, amount } = req.params;
    const upiUrl = `upi://pay?pa=${upiId}&am=${amount}&cu=INR`;
    const qrDataUrl = await QRCode.toDataURL(upiUrl, { width: 250, margin: 2 });
    res.json({ qr: qrDataUrl, upi_url: upiUrl });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/order', authMiddleware, async (req, res) => {
  try {
    const { panel_id, duration, promo_code, payment_method, customer_email } = req.body;
    const panel = await pool.query('SELECT * FROM panels WHERE id = $1', [panel_id]);
    if (panel.rows.length === 0) return res.status(404).json({ error: 'Panel not found' });
    // All panels are purchasable - keys will be auto-assigned if available or manually delivered by admin

    const p = panel.rows[0];
    let price = 0;
    const fixedDurations = { '1day': 'price_1day', '7day': 'price_7day', '30day': 'price_30day', '60day': 'price_60day' };
    if (fixedDurations[duration]) {
      price = parseFloat(p[fixedDurations[duration]]);
    } else {
      const dayMatch = duration.match(/^(\d+)day$/);
      if (dayMatch) {
        const customPrices = p.custom_prices || {};
        const cp = customPrices[dayMatch[1]];
        if (cp && parseFloat(cp.price) > 0) {
          price = parseFloat(cp.price);
        }
      }
    }
    if (!price || price <= 0) return res.status(400).json({ error: 'Invalid duration' });

    let discount = 0;
    if (promo_code) {
      const promoRes = await pool.query('SELECT * FROM promo_codes WHERE code = $1 AND is_active = true', [promo_code.toUpperCase()]);
      if (promoRes.rows.length > 0) {
        const promo = promoRes.rows[0];
        if (promo.discount_percent > 0) discount = (price * promo.discount_percent) / 100;
        if (promo.discount_amount > 0) discount = parseFloat(promo.discount_amount);
        discount = Math.min(discount, price);
        await pool.query('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1', [promo.id]);
      }
    }

    const finalPrice = price - discount;
    const user = await pool.query('SELECT username, email, telegram_username FROM users WHERE id = $1', [req.user.id]);

    const result = await pool.query(
      `INSERT INTO orders (user_id, panel_id, panel_name, duration, price, discount, final_price, promo_code, payment_method, status, customer_username, customer_telegram, customer_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [req.user.id, panel_id, p.name, duration, price, discount, finalPrice, promo_code || '', payment_method || 'upi', 'pending_payment',
       user.rows[0].username, user.rows[0].telegram_username, customer_email || user.rows[0].email]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/order/:id/cancel-beacon', async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(401).json({ error: 'No token' });
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../auth');
    const decoded = jwt.verify(token, JWT_SECRET);
    const order = await pool.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [req.params.id, decoded.id]);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (order.rows[0].status !== 'pending_payment') return res.json({ success: true });
    await pool.query("UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/order/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const order = await pool.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    if (order.rows[0].status !== 'pending_payment') return res.status(400).json({ error: 'Can only cancel pending payment orders' });
    await pool.query("UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/order/:id/utr', authMiddleware, async (req, res) => {
  try {
    const { utr_number } = req.body;
    if (!utr_number) return res.status(400).json({ error: 'UTR number required' });
    const order = await pool.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    if (order.rows[0].status !== 'pending_payment') {
      return res.status(400).json({ error: 'Order is no longer awaiting payment' });
    }

    await pool.query("UPDATE orders SET utr_number = $1, status = 'pending_verification', updated_at = NOW() WHERE id = $2", [utr_number, req.params.id]);

    const notifEnabled = await pool.query("SELECT value FROM settings WHERE key = 'notifications_enabled'");
    if (!notifEnabled.rows.length || notifEnabled.rows[0].value === 'true') {
      const existing = await pool.query('SELECT id FROM admin_notifications WHERE type = $1 AND order_id = $2', ['new_order', parseInt(req.params.id)]);
      if (existing.rows.length === 0) {
        const o = order.rows[0];
        const msg = `${o.customer_username} ordered ${o.panel_name} (${o.duration}) - $${o.final_price} via ${o.payment_method}`;
        await pool.query(
          'INSERT INTO admin_notifications (type, title, message, order_id) VALUES ($1, $2, $3, $4)',
          ['new_order', `New Order #${o.id}`, msg, o.id]
        );
        sendPushToAdmins(`New Order #${o.id}`, msg, '/admin/orders').catch(() => {});
      }
    }

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/order/:id/proof', authMiddleware, proofUpload.single('proof'), async (req, res) => {
  try {
    const order = await pool.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (order.rows.length === 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Order not found' });
    }
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    const oldProof = order.rows[0].payment_proof_image;
    if (oldProof) {
      const oldPath = path.join(uploadsDir, oldProof);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    const filePath = path.join(uploadsDir, req.file.filename);
    const fileData = fs.readFileSync(filePath);
    await pool.query('UPDATE orders SET payment_proof_image = $1, payment_proof_data = $2, payment_proof_mime = $3, updated_at = NOW() WHERE id = $4', [req.file.filename, fileData, req.file.mimetype, req.params.id]);
    res.json({ filename: req.file.filename });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/my-orders', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/download/:orderId/:fileId', (req, res, next) => {
  if (req.query.token) req.headers.authorization = `Bearer ${req.query.token}`;
  next();
}, authMiddleware, async (req, res) => {
  try {
    const { orderId, fileId } = req.params;
    const order = await pool.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [orderId, req.user.id]);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    if (order.rows[0].status !== 'delivered') return res.status(403).json({ error: 'Order not delivered yet' });

    let files = [];
    try { files = JSON.parse(order.rows[0].delivered_files || '[]'); } catch { files = []; }
    const file = files.find(f => f.id === fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });

    const filePath = path.join(uploadsDir, file.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on server' });

    res.download(filePath, file.originalName);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/panel-files', async (req, res) => {
  try {
    const cols = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'panel_files'
    `);
    const names = cols.rows.map(r => r.column_name);
    const safe = (col, alias) => names.includes(col) ? `${col} AS ${alias}` : `'' AS ${alias}`;
    const result = await pool.query(`
      SELECT
        id, title,
        COALESCE(description, '') AS description,
        COALESCE(version, '1.0') AS version,
        COALESCE(file_path, '') AS file_path,
        COALESCE(thumbnail, '') AS thumbnail,
        COALESCE(file_size, '') AS file_size,
        ${safe('update_date', 'update_date')},
        created_at
      FROM panel_files
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/panel-files/:id/download', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM panel_files WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'File not found' });
    const f = result.rows[0];
    const filePath = path.join(uploadsDir, f.file_path);
    if (fs.existsSync(filePath)) {
      return res.download(filePath, f.original_filename || f.file_path);
    }
    if (f.file_data) {
      const downloadName = f.original_filename || f.file_path;
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
      res.setHeader('Content-Type', f.file_mime || 'application/octet-stream');
      return res.send(f.file_data);
    }
    res.status(404).json({ error: 'File not found on server' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
