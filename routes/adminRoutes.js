const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authMiddleware, adminMiddleware } = require('../auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const prefix = file.mimetype.startsWith('video/') ? 'vid' : 'img';
    cb(null, `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const mediaUpload = multer({
  storage: mediaStorage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Images and videos only'));
  }
});

const brandingStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `brand_${req.body.type || 'file'}_${Date.now()}${path.extname(file.originalname)}`)
});
const brandingUpload = multer({ storage: brandingStorage, limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authMiddleware);
router.use(adminMiddleware);

// ── Settings ────────────────────────────────────────────────────────────────
router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM store_settings LIMIT 1');
    res.json(result.rows[0] || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/settings', async (req, res) => {
  try {
    const { store_name, store_description, announcement, telegram_support, whatsapp_support, telegram_reseller_link, theme_color, particle_effect, banner_data } = req.body;
    const existing = await pool.query('SELECT id FROM store_settings LIMIT 1');
    if (existing.rows.length === 0) {
      await pool.query(
        'INSERT INTO store_settings (store_name,store_description,announcement,telegram_support,whatsapp_support,telegram_reseller_link,theme_color,particle_effect,banner_data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [store_name, store_description, announcement, telegram_support, whatsapp_support, telegram_reseller_link, theme_color, particle_effect, banner_data]
      );
    } else {
      await pool.query(
        'UPDATE store_settings SET store_name=$1,store_description=$2,announcement=$3,telegram_support=$4,whatsapp_support=$5,telegram_reseller_link=$6,theme_color=$7,particle_effect=$8,banner_data=$9 WHERE id=$10',
        [store_name, store_description, announcement, telegram_support, whatsapp_support, telegram_reseller_link, theme_color, particle_effect, banner_data, existing.rows[0].id]
      );
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/upload-branding', brandingUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const type = req.body.type;
    const filename = req.file.filename;
    const existing = await pool.query('SELECT id FROM store_settings LIMIT 1');
    const col = `branding_${type}`;
    if (existing.rows.length === 0) {
      await pool.query(`INSERT INTO store_settings (${col}) VALUES ($1)`, [filename]);
    } else {
      await pool.query(`UPDATE store_settings SET ${col}=$1 WHERE id=$2`, [filename, existing.rows[0].id]);
    }
    res.json({ filename, url: `/uploads/${filename}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Panels ───────────────────────────────────────────────────────────────────
router.get('/panels', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM panels ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/panels', async (req, res) => {
  try {
    const { name, description, ios_price, android_price, section_id, is_active } = req.body;
    const result = await pool.query(
      'INSERT INTO panels (name,description,ios_price,android_price,section_id,is_active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [name, description || '', ios_price || 0, android_price || 0, section_id || null, is_active !== false]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/panels/:id', async (req, res) => {
  try {
    const { name, description, ios_price, android_price, section_id, is_active } = req.body;
    const result = await pool.query(
      'UPDATE panels SET name=$1,description=$2,ios_price=$3,android_price=$4,section_id=$5,is_active=$6 WHERE id=$7 RETURNING *',
      [name, description || '', ios_price || 0, android_price || 0, section_id || null, is_active !== false, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/panels/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM panels WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Panel Files ───────────────────────────────────────────────────────────────
router.get('/panel-files', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM panel_files ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/panel-files', async (req, res) => {
  try {
    const { title, description, version, file_size, update_date, download_url, thumbnail_url } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    if (!download_url) return res.status(400).json({ error: 'Download URL required' });
    const result = await pool.query(
      'INSERT INTO panel_files (title,description,version,file_size,update_date,thumbnail,file_path,original_filename) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [title, description || '', version || '1.0', file_size || '', update_date || new Date().toISOString().split('T')[0], thumbnail_url || '', download_url, '']
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/panel-files/:id', async (req, res) => {
  try {
    const { title, description, version, file_size, update_date, download_url, thumbnail_url } = req.body;
    const existing = await pool.query('SELECT * FROM panel_files WHERE id=$1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const row = existing.rows[0];
    const result = await pool.query(
      'UPDATE panel_files SET title=$1,description=$2,version=$3,file_size=$4,update_date=$5,thumbnail=$6,file_path=$7 WHERE id=$8 RETURNING *',
      [title ?? row.title, description ?? row.description, version || row.version, file_size ?? row.file_size, update_date || row.update_date, thumbnail_url ?? row.thumbnail, download_url || row.file_path, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/panel-files/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM panel_files WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Panel Media (photos + video) ─────────────────────────────────────────────
router.get('/panel-files/:id/media', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM panel_media WHERE panel_file_id=$1 ORDER BY display_order, created_at',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/panel-files/:id/media', mediaUpload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
    const panelFileId = req.params.id;
    const countRes = await pool.query('SELECT COUNT(*) FROM panel_media WHERE panel_file_id=$1', [panelFileId]);
    let orderStart = parseInt(countRes.rows[0].count);
    const inserted = [];
    for (const file of req.files) {
      const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
      const filePath = `/uploads/${file.filename}`;
      const r = await pool.query(
        'INSERT INTO panel_media (panel_file_id, media_type, file_path, display_order) VALUES ($1,$2,$3,$4) RETURNING *',
        [panelFileId, mediaType, filePath, orderStart++]
      );
      inserted.push(r.rows[0]);
    }
    res.json(inserted);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/panel-media/:id', async (req, res) => {
  try {
    const existing = await pool.query('SELECT file_path FROM panel_media WHERE id=$1', [req.params.id]);
    if (existing.rows.length > 0) {
      const fp = path.join(__dirname, '..', '..', existing.rows[0].file_path);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await pool.query('DELETE FROM panel_media WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Sections ─────────────────────────────────────────────────────────────────
router.get('/sections', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sections ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/sections', async (req, res) => {
  try {
    const { name } = req.body;
    const result = await pool.query('INSERT INTO sections (name) VALUES ($1) RETURNING *', [name]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/sections/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM sections WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Orders ────────────────────────────────────────────────────────────────────
router.get('/orders', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT o.*, u.email, u.username FROM orders o LEFT JOIN users u ON o.user_id=u.id ORDER BY o.created_at DESC'
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    await pool.query('UPDATE orders SET status=$1 WHERE id=$2', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Users ─────────────────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT id,username,email,is_admin,created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id=$1 AND is_admin=false', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
