const express = require('express');
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { authMiddleware, adminMiddleware } = require('../auth');
const cloudinary = require('../cloudinary');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}_${unique}${ext}`);
  }
});
const mediaFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image (jpg, png, webp, gif) and video (mp4, webm, mov) files are allowed'), false);
  }
};

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
// Panel images stored in DB (memoryStorage) — no Render disk dependency
  const mediaUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: mediaFilter });

// Memory-only storage for branding — never writes to disk, survives Render redeploys
const brandingUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = express.Router();
router.use(authMiddleware, adminMiddleware);

router.get('/settings', async (req, res) => {
  if (req.user.role !== 'main_admin' && !req.user.permissions?.manage_settings) {
    return res.status(403).json({ error: 'Access Denied' });
  }
  try {
    const result = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/settings', async (req, res) => {
  try {
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      if (value === null || value === undefined) continue;
      const strVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
      const updated = await pool.query('UPDATE settings SET value = $2 WHERE key = $1', [key, strVal]);
      if (updated.rowCount === 0) {
        await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2)', [key, strVal]);
      }
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/sections', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sections ORDER BY sort_order, id');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/sections', async (req, res) => {
  try {
    const { name, description, sort_order } = req.body;
    const result = await pool.query(
      'INSERT INTO sections (name, description, sort_order) VALUES ($1, $2, $3) RETURNING *',
      [name, description || '', sort_order || 0]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/sections/:id', async (req, res) => {
  try {
    const { name, description, sort_order, is_active } = req.body;
    await pool.query(
      'UPDATE sections SET name=COALESCE($1,name), description=COALESCE($2,description), sort_order=COALESCE($3,sort_order), is_active=COALESCE($4,is_active) WHERE id=$5',
      [name, description, sort_order, is_active, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/sections/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM sections WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/panels', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, s.name as section_name FROM panels p
      LEFT JOIN sections s ON p.section_id = s.id
      ORDER BY p.sort_order, p.id
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/panels', async (req, res) => {
  try {
    const { section_id, name, description, platform, price_1day, price_7day, price_30day, price_60day, reseller_price_1day, reseller_price_7day, reseller_price_30day, reseller_price_60day, features, image_url, custom_prices, hidden_durations } = req.body;
    const prices = [price_1day, price_7day, price_30day, price_60day].map(p => parseFloat(p) || 0);
    const rPrices = [reseller_price_1day, reseller_price_7day, reseller_price_30day, reseller_price_60day].map(p => parseFloat(p) || 0);
    for (const p of prices) {
      if (p > 0 && p < 1) return res.status(400).json({ error: 'Minimum price is $1 USD' });
    }
    const result = await pool.query(
      `INSERT INTO panels (section_id, name, description, platform, price_1day, price_7day, price_30day, price_60day, reseller_price_1day, reseller_price_7day, reseller_price_30day, reseller_price_60day, features, image_url, custom_prices, hidden_durations)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [section_id, name, description || '', platform || 'both', prices[0], prices[1], prices[2], prices[3], rPrices[0], rPrices[1], rPrices[2], rPrices[3], features || '', image_url || '', JSON.stringify(custom_prices || {}), JSON.stringify(hidden_durations || {})]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/panels/:id', async (req, res) => {
  try {
    const { section_id, name, description, platform, price_1day, price_7day, price_30day, price_60day, reseller_price_1day, reseller_price_7day, reseller_price_30day, reseller_price_60day, features, is_in_stock, is_active, image_url, sort_order, custom_prices, hidden_durations } = req.body;
    const priceFields = [price_1day, price_7day, price_30day, price_60day];
    for (const p of priceFields) {
      if (p !== undefined && p !== null) {
        const val = parseFloat(p);
        if (val > 0 && val < 1) return res.status(400).json({ error: 'Minimum price is $1 USD' });
      }
    }
    await pool.query(
      `UPDATE panels SET
        section_id=COALESCE($1,section_id), name=COALESCE($2,name), description=COALESCE($3,description),
        platform=COALESCE($4,platform), price_1day=COALESCE($5,price_1day), price_7day=COALESCE($6,price_7day),
        price_30day=COALESCE($7,price_30day), price_60day=COALESCE($8,price_60day), features=COALESCE($9,features),
        is_in_stock=COALESCE($10,is_in_stock), is_active=COALESCE($11,is_active), image_url=COALESCE($12,image_url),
        sort_order=COALESCE($13,sort_order),
        reseller_price_1day=COALESCE($14,reseller_price_1day), reseller_price_7day=COALESCE($15,reseller_price_7day),
        reseller_price_30day=COALESCE($16,reseller_price_30day), reseller_price_60day=COALESCE($17,reseller_price_60day),
        custom_prices=COALESCE($18,custom_prices),
        hidden_durations=COALESCE($19,hidden_durations)
       WHERE id=$20`,
      [section_id, name, description, platform, price_1day, price_7day, price_30day, price_60day, features, is_in_stock, is_active, image_url, sort_order, reseller_price_1day, reseller_price_7day, reseller_price_30day, reseller_price_60day, custom_prices !== undefined ? JSON.stringify(custom_prices) : null, hidden_durations !== undefined ? JSON.stringify(hidden_durations) : null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/panels/:id', async (req, res) => {
  try {
    const imgs = await pool.query('SELECT filename FROM panel_images WHERE panel_id = $1', [req.params.id]);
    for (const img of imgs.rows) {
      const fp = path.join(uploadsDir, img.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await pool.query('DELETE FROM panels WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/panels/:id/images', async (req, res) => {
    try {
      const result = await pool.query('SELECT id, panel_id, filename, original_name, sort_order, media_type, file_data, created_at FROM panel_images WHERE panel_id = $1 ORDER BY sort_order, id', [req.params.id]);
      const rows = result.rows.map(r => ({ ...r, data_url: r.file_data ? r.file_data.toString() : null, file_data: undefined }));
      res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });;

router.post('/panels/:id/images', async (req, res) => {
    try {
      const panelId = req.params.id;
      const panelCheck = await pool.query('SELECT id FROM panels WHERE id = $1', [panelId]);
      if (panelCheck.rows.length === 0) return res.status(404).json({ error: 'Panel not found' });
      const maxOrder = await pool.query('SELECT COALESCE(MAX(sort_order), 0) as max_order FROM panel_images WHERE panel_id = $1', [panelId]);
      let sortOrder = maxOrder.rows[0].max_order + 1;
      const uploadedImages = req.body?.images || [];
      const saved = [];
      for (const img of uploadedImages) {
        const { data_url, filename, media_type } = img;
        if (!data_url) continue;
        const mime = data_url.split(';')[0].replace('data:', '');
        const isVideo = mime.startsWith('video/');
        let uploadRes;
        if (isVideo) {
          uploadRes = await cloudinary.uploader.upload_large(data_url, {
            folder: 'panel-images',
            resource_type: 'video',
            chunk_size: 6000000
          });
        } else {
          uploadRes = await cloudinary.uploader.upload(data_url, {
            folder: 'panel-images',
            resource_type: 'image'
          });
        }
        const cloudUrl = uploadRes.secure_url;
        const result = await pool.query(
          'INSERT INTO panel_images (panel_id, filename, original_name, sort_order, media_type, file_data, mime_type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, panel_id, filename, original_name, sort_order, media_type, created_at',
          [panelId, filename || 'image', filename || 'image', sortOrder++, media_type || (isVideo ? 'video' : 'image'), cloudUrl, mime]
        );
        saved.push({ ...result.rows[0], data_url: cloudUrl });
      }
      res.json(saved);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

router.delete('/panels/:panelId/images/:imageId', async (req, res) => {
  try {
    const result = await pool.query('SELECT filename FROM panel_images WHERE id = $1 AND panel_id = $2', [req.params.imageId, req.params.panelId]);
    if (result.rows.length > 0) {

      await pool.query('DELETE FROM panel_images WHERE id = $1', [req.params.imageId]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/promo-codes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM promo_codes ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/promo-codes', async (req, res) => {
  try {
    const { code, discount_percent, discount_amount, min_order, max_uses, expires_at } = req.body;
    const result = await pool.query(
      'INSERT INTO promo_codes (code, discount_percent, discount_amount, min_order, max_uses, expires_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [code.toUpperCase(), discount_percent || 0, discount_amount || 0, min_order || 0, max_uses || 0, expires_at || null]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/promo-codes/:id', async (req, res) => {
  try {
    const { code, discount_percent, discount_amount, min_order, max_uses, is_active, expires_at } = req.body;
    await pool.query(
      `UPDATE promo_codes SET code=COALESCE($1,code), discount_percent=COALESCE($2,discount_percent),
       discount_amount=COALESCE($3,discount_amount), min_order=COALESCE($4,min_order),
       max_uses=COALESCE($5,max_uses), is_active=COALESCE($6,is_active), expires_at=COALESCE($7,expires_at) WHERE id=$8`,
      [code, discount_percent, discount_amount, min_order, max_uses, is_active, expires_at, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/promo-codes/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM promo_codes WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/orders', async (req, res) => {
  if (req.user.role !== 'main_admin' && !req.user.permissions?.view_payments) {
    return res.status(403).json({ error: 'Access Denied' });
  }
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM orders ORDER BY created_at DESC';
    let params = [];
    if (status) {
      query = 'SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC';
      params = [status];
    }
    const result = await pool.query(query, params);
    const rows = result.rows.map(r => {
        let proof_data_url = null;
        if (r.payment_proof_data) {
          const val = Buffer.isBuffer(r.payment_proof_data) ? r.payment_proof_data.toString() : String(r.payment_proof_data);
          proof_data_url = val.startsWith('http') ? val : `data:${r.payment_proof_mime || 'image/jpeg'};base64,${val}`;
        }
        return { ...r, proof_data_url, payment_proof_data: undefined };
      });
      res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/orders/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { status, key_delivered, admin_notes, delivered_files } = req.body;
    await client.query('BEGIN');

    const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = orderResult.rows[0];

    if (status === 'approved' && (order.status === 'approved' || order.status === 'delivered')) {
      await client.query('ROLLBACK');
      return res.json({ success: true, message: 'Order already processed' });
    }

    let autoKey = key_delivered || null;
    let autoNotes = admin_notes || null;

    if (status === 'approved' && order.status !== 'approved' && order.status !== 'delivered') {
      const durationMatch = order.duration.match(/^(\d+)day$/);
      const durationDays = durationMatch ? parseInt(durationMatch[1]) : null;

      if (durationDays && order.panel_id) {
        const keyResult = await client.query(
          "SELECT id, key_value FROM customer_key_pool WHERE panel_id = $1 AND duration_days = $2 AND status = 'available' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED",
          [order.panel_id, durationDays]
        );
        if (keyResult.rows.length > 0) {
          const poolKey = keyResult.rows[0];
          await client.query("UPDATE customer_key_pool SET status = 'sold', assigned_order_id = $1 WHERE id = $2", [order.id, poolKey.id]);
          autoKey = poolKey.key_value;
        }
      }
    }

    if (status === 'rejected' && order.status !== 'rejected') {
      autoNotes = admin_notes || 'Your payment was rejected. This may be due to wrong TXN ID or proof. Please contact support.';
    }

    const finalStatus = (status === 'approved' && autoKey) ? 'delivered' : (status === 'approved' ? 'approved' : status);

    await client.query(
      'UPDATE orders SET status=COALESCE($1,status), key_delivered=COALESCE($2,key_delivered), admin_notes=COALESCE($3,admin_notes), delivered_files=COALESCE($4,delivered_files), updated_at=NOW() WHERE id=$5',
      [finalStatus, autoKey, autoNotes, delivered_files, req.params.id]
    );

    // Auto-delete payment proof screenshot when delivered — keeps DB clean
      if (finalStatus === 'delivered') {
        await client.query('UPDATE orders SET payment_proof_data = NULL, payment_proof_mime = NULL WHERE id = $1', [req.params.id]);
      }

      await client.query('COMMIT');
      res.json({ success: true, auto_key: !!autoKey && status === 'approved' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post('/orders/:id/upload', upload.array('files', 10), async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await pool.query('SELECT delivered_files FROM orders WHERE id = $1', [orderId]);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    let existingFiles = [];
    try { existingFiles = JSON.parse(order.rows[0].delivered_files || '[]'); } catch { existingFiles = []; }

    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
      const newFiles = (req.files || []).map(f => ({
      id: crypto.randomBytes(6).toString('hex'),
      filename: f.filename,
      originalName: f.originalname,
      size: f.size,
      uploadedAt: new Date().toISOString()
    }));

    const allFiles = [...existingFiles, ...newFiles];
    await pool.query('UPDATE orders SET delivered_files = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(allFiles), orderId]);
    res.json({ files: allFiles });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/orders/:orderId', async (req, res) => {
  if (req.user.role !== 'main_admin' && !req.user.permissions?.manage_orders && !req.user.permissions?.view_payments) {
    return res.status(403).json({ error: 'Access Denied' });
  }
  try {
    const order = await pool.query('SELECT delivered_files, payment_proof_image FROM orders WHERE id = $1', [req.params.orderId]);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    let files = [];
    try { files = JSON.parse(order.rows[0].delivered_files || '[]'); } catch { files = []; }
    for (const f of files) {
      const fp = path.join(uploadsDir, f.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    if (order.rows[0].payment_proof_image) {
      const pp = path.join(uploadsDir, order.rows[0].payment_proof_image);
      if (fs.existsSync(pp)) fs.unlinkSync(pp);
    }
    await pool.query('DELETE FROM orders WHERE id = $1', [req.params.orderId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/orders/:orderId/files/:fileId', async (req, res) => {
  try {
    const { orderId, fileId } = req.params;
    const order = await pool.query('SELECT delivered_files FROM orders WHERE id = $1', [orderId]);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    let files = [];
    try { files = JSON.parse(order.rows[0].delivered_files || '[]'); } catch { files = []; }

    const fileToDelete = files.find(f => f.id === fileId);
    if (fileToDelete) {
      const filePath = path.join(uploadsDir, fileToDelete.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    const remaining = files.filter(f => f.id !== fileId);
    await pool.query('UPDATE orders SET delivered_files = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(remaining), orderId]);
    res.json({ files: remaining });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/resellers', async (req, res) => {
  if (req.user.role !== 'main_admin' && !req.user.permissions?.manage_resellers) {
    return res.status(403).json({ error: 'Access Denied' });
  }
  try {
    const result = await pool.query('SELECT id, username, display_name, status, wallet_balance, created_at FROM resellers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/resellers', async (req, res) => {
  try {
    const { username, password, display_name } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO resellers (username, password, display_name) VALUES ($1, $2, $3) RETURNING id, username, display_name, status, wallet_balance, created_at',
      [username, hash, display_name || username]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Username already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/resellers/:id', async (req, res) => {
  try {
    const { display_name, status, wallet_balance, password } = req.body;
    if (password) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash(password, 10);
      await pool.query('UPDATE resellers SET password = $1 WHERE id = $2', [hash, req.params.id]);
    }
    await pool.query(
      'UPDATE resellers SET display_name=COALESCE($1,display_name), status=COALESCE($2,status), wallet_balance=COALESCE($3,wallet_balance) WHERE id=$4',
      [display_name, status, wallet_balance, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/resellers/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM resellers WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/reseller-topups', async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT t.*, r.username as reseller_username, r.display_name as reseller_name, p.name as package_name FROM reseller_topups t LEFT JOIN resellers r ON t.reseller_id = r.id LEFT JOIN reseller_packages p ON t.package_id = p.id';
    let params = [];
    if (status) {
      query += ' WHERE t.status = $1';
      params = [status];
    }
    query += ' ORDER BY t.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/reseller-topups/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { status } = req.body;
    await client.query('BEGIN');

    const topup = await client.query('SELECT * FROM reseller_topups WHERE id = $1', [req.params.id]);
    if (topup.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Topup not found' });
    }

    const t = topup.rows[0];

    if (status === 'approved' && t.status !== 'approved') {
      await client.query('UPDATE resellers SET wallet_balance = wallet_balance + $1 WHERE id = $2', [t.amount_usd, t.reseller_id]);
    }

    await client.query('UPDATE reseller_topups SET status = $1 WHERE id = $2', [status, req.params.id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.get('/reseller-packages', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reseller_packages ORDER BY sort_order, id');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/reseller-packages', async (req, res) => {
  try {
    const { name, amount_usd, price_usd, sort_order } = req.body;
    const result = await pool.query(
      'INSERT INTO reseller_packages (name, amount_usd, price_usd, sort_order) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, amount_usd, price_usd, sort_order || 0]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/reseller-packages/:id', async (req, res) => {
  try {
    const { name, amount_usd, price_usd, is_active, sort_order } = req.body;
    await pool.query(
      'UPDATE reseller_packages SET name=COALESCE($1,name), amount_usd=COALESCE($2,amount_usd), price_usd=COALESCE($3,price_usd), is_active=COALESCE($4,is_active), sort_order=COALESCE($5,sort_order) WHERE id=$6',
      [name, amount_usd, price_usd, is_active, sort_order, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/reseller-packages/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM reseller_packages WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/reseller-key-pool', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT rkp.*, p.name as panel_name
      FROM reseller_key_pool rkp
      LEFT JOIN panels p ON rkp.panel_id = p.id
      ORDER BY rkp.duration_days, rkp.id
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/reseller-key-pool', async (req, res) => {
  try {
    const { panel_id, duration_days, keys } = req.body;
    if (!panel_id || !duration_days || !keys || !keys.length) return res.status(400).json({ error: 'Panel, duration and keys required' });
    const inserted = [];
    for (const key of keys) {
      const trimmed = key.trim();
      if (!trimmed) continue;
      const result = await pool.query(
        'INSERT INTO reseller_key_pool (panel_id, duration_days, key_value) VALUES ($1, $2, $3) RETURNING *',
        [panel_id, duration_days, trimmed]
      );
      inserted.push(result.rows[0]);
    }
    res.json(inserted);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/reseller-key-pool/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM reseller_key_pool WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/reseller-key-orders', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT o.*, r.username as reseller_username, r.display_name as reseller_name FROM reseller_key_orders o LEFT JOIN resellers r ON o.reseller_id = r.id ORDER BY o.created_at DESC'
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/customer-key-pool', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ckp.*, p.name as panel_name
      FROM customer_key_pool ckp
      LEFT JOIN panels p ON ckp.panel_id = p.id
      ORDER BY ckp.panel_id, ckp.duration_days, ckp.id
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/customer-key-pool', async (req, res) => {
  try {
    const { panel_id, duration_days, keys } = req.body;
    if (!panel_id || !duration_days || !keys || !keys.length) return res.status(400).json({ error: 'Panel, duration and keys required' });
    const inserted = [];
    for (const key of keys) {
      const trimmed = key.trim();
      if (!trimmed) continue;
      const result = await pool.query(
        'INSERT INTO customer_key_pool (panel_id, duration_days, key_value) VALUES ($1, $2, $3) RETURNING *',
        [panel_id, duration_days, trimmed]
      );
      inserted.push(result.rows[0]);
    }
    res.json(inserted);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/customer-key-pool/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM customer_key_pool WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/admins', async (req, res) => {
  try {
    if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'Main Admin access required' });
    const result = await pool.query('SELECT id, username, role, permissions, created_at FROM admins ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admins', async (req, res) => {
  try {
    if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'Main Admin access required' });
    const { username, password, permissions } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO admins (username, password, role, permissions) VALUES ($1, $2, $3, $4) RETURNING id, username, role, permissions',
      [username, hash, 'admin', JSON.stringify(permissions || {})]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Username already exists' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/admins/:id', async (req, res) => {
  try {
    if (req.user.role !== 'main_admin') return res.status(403).json({ error: 'Main Admin access required' });
    await pool.query('DELETE FROM admins WHERE id = $1 AND role != $2', [req.params.id, 'main_admin']);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users', async (req, res) => {
  if (req.user.role !== 'main_admin' && !req.user.permissions?.manage_users) {
    return res.status(403).json({ error: 'Access Denied' });
  }
  try {
    const result = await pool.query('SELECT id, username, email, telegram_username, is_admin, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats', async (req, res) => {
  try {
    const users = await pool.query('SELECT COUNT(*) FROM users WHERE is_admin = false');
    const orders = await pool.query('SELECT COUNT(*) FROM orders');
    const pending = await pool.query("SELECT COUNT(*) FROM orders WHERE status = 'pending_verification'");
    const revenue = await pool.query("SELECT COALESCE(SUM(final_price), 0) as total FROM orders WHERE status = 'approved'");
    res.json({
      total_users: parseInt(users.rows[0].count),
      total_orders: parseInt(orders.rows[0].count),
      pending_orders: parseInt(pending.rows[0].count),
      total_revenue: parseFloat(revenue.rows[0].total)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/panel-files', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, title, description, version, file_size, update_date, thumbnail, file_path, original_filename, created_at FROM panel_files ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/panel-files', async (req, res) => {
    try {
      const { title, description, version, file_size, update_date, file_url, thumbnail_url } = req.body;
      if (!title) return res.status(400).json({ error: 'Title required' });
      if (!file_url) return res.status(400).json({ error: 'File URL required' });
      const result = await pool.query(
        'INSERT INTO panel_files (title, description, version, file_size, update_date, thumbnail, file_path, original_filename) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, title, description, version, file_size, update_date, thumbnail, file_path, original_filename, created_at',
        [title, description || '', version || '1.0', file_size || '', update_date || new Date().toISOString().split('T')[0], thumbnail_url || '', file_url, title]
      );
      res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.put('/panel-files/:id', async (req, res) => {
    try {
      const { title, description, version, file_size, update_date, file_url, thumbnail_url } = req.body;
      const existing = await pool.query('SELECT * FROM panel_files WHERE id = $1', [req.params.id]);
      if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      await pool.query(
        `UPDATE panel_files SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          version = COALESCE($3, version),
          file_size = COALESCE($4, file_size),
          update_date = COALESCE($5, update_date),
          thumbnail = COALESCE($6, thumbnail),
          file_path = COALESCE($7, file_path)
        WHERE id = $8`,
        [title||null, description||null, version||null, file_size||null, update_date||null, thumbnail_url||null, file_url||null, req.params.id]
      );
      const updated = await pool.query('SELECT id, title, description, version, file_size, update_date, thumbnail, file_path, original_filename, created_at FROM panel_files WHERE id=$1', [req.params.id]);
      res.json(updated.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.delete('/panel-files/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM panel_files WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

router.delete('/reseller-key-pool-bulk', async (req, res) => {
  try {
    const { ids, clear_sold } = req.body;
    if (clear_sold) {
      const result = await pool.query("DELETE FROM reseller_key_pool WHERE status = 'sold'");
      return res.json({ success: true, deleted: result.rowCount });
    }
    if (ids && ids.length > 0) {
      const result = await pool.query('DELETE FROM reseller_key_pool WHERE id = ANY($1)', [ids]);
      return res.json({ success: true, deleted: result.rowCount });
    }
    res.status(400).json({ error: 'No keys specified' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/customer-key-pool-bulk', async (req, res) => {
  try {
    const { ids, clear_sold } = req.body;
    if (clear_sold) {
      const result = await pool.query("DELETE FROM customer_key_pool WHERE status = 'sold'");
      return res.json({ success: true, deleted: result.rowCount });
    }
    if (ids && ids.length > 0) {
      const result = await pool.query('DELETE FROM customer_key_pool WHERE id = ANY($1)', [ids]);
      return res.json({ success: true, deleted: result.rowCount });
    }
    res.status(400).json({ error: 'No keys specified' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/upload-branding', async (req, res) => {
    try {
      const { type, data_url } = req.body || {};
      if (!type || !data_url) return res.status(400).json({ error: 'type and data_url required' });
      const key = `branding_${type}`;
      const mime = data_url.split(';')[0].replace('data:', '');
      async function upsertSetting(k, v) {
        const r = await pool.query('UPDATE settings SET value = $2 WHERE key = $1', [k, v]);
        if (r.rowCount === 0) await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2)', [k, v]);
      }
      const uploadRes = await cloudinary.uploader.upload(data_url, {
        folder: 'branding',
        resource_type: 'image'
      });
      const cloudUrl = uploadRes.secure_url;
      await upsertSetting(`${key}_data`, cloudUrl);
      await upsertSetting(`${key}_mime`, mime);
      res.json({ success: true, type, data_url: cloudUrl });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });;

// Serve panel image/video — redirect to Cloudinary for new records, fallback binary for old base64
  router.get('/panels/:panelId/images/:imageId/data', async (req, res) => {
    try {
      const result = await pool.query('SELECT file_data, mime_type FROM panel_images WHERE id = $1 AND panel_id = $2', [req.params.imageId, req.params.panelId]);
      if (!result.rows[0]?.file_data) return res.status(404).json({ error: 'Image not found' });
      const val = result.rows[0].file_data.toString();
      if (val.startsWith('http')) return res.redirect(val);
      res.setHeader('Content-Type', result.rows[0].mime_type || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(Buffer.from(val.split(',')[1] || val, 'base64'));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Clear branding from database
  router.delete('/branding/:type', async (req, res) => {
    try {
      const { type } = req.params;
      await pool.query('DELETE FROM settings WHERE key = $1 OR key = $2', [`branding_${type}_data`, `branding_${type}_mime`]);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Serve payment proof — redirect to Cloudinary for new records, fallback binary for old base64
  router.get('/orders/:id/proof', async (req, res) => {
    try {
      const result = await pool.query('SELECT payment_proof_data, payment_proof_mime FROM orders WHERE id = $1', [req.params.id]);
      if (!result.rows[0]?.payment_proof_data) return res.status(404).json({ error: 'No proof found' });
      const val = Buffer.isBuffer(result.rows[0].payment_proof_data) ? result.rows[0].payment_proof_data.toString() : String(result.rows[0].payment_proof_data);
      if (val.startsWith('http')) return res.redirect(val);
      const buffer = Buffer.from(val, 'base64');
      res.setHeader('Content-Type', result.rows[0].payment_proof_mime || 'image/jpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.send(buffer);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/vapid-public-key', async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'vapid_public_key'");
    res.json({ key: result.rows[0]?.value || '' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/push-subscribe', async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) return res.status(400).json({ error: 'Invalid subscription' });
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [subscription.endpoint]);
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth) VALUES ($1, $2, $3, $4)`,
      [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/push-unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/notifications', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/notifications/unread-count', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM admin_notifications WHERE is_read = false');
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/notifications/:id/read', async (req, res) => {
  try {
    await pool.query('UPDATE admin_notifications SET is_read = true WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/notifications/read-all', async (req, res) => {
  try {
    await pool.query('UPDATE admin_notifications SET is_read = true');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/notifications/clear-all', async (req, res) => {
  try {
    await pool.query('DELETE FROM admin_notifications');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/notifications/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM admin_notifications WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
