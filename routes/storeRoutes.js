const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authMiddleware } = require('../auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

let pushNotify;
try { pushNotify = require('../pushNotify'); } catch (e) { pushNotify = null; }

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const proofStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `proof_${Date.now()}${path.extname(file.originalname)}`)
});
const proofUpload = multer({
  storage: proofStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Image files only'));
  }
});

router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM store_settings LIMIT 1');
    res.json(result.rows[0] || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/panels', async (req, res) => {
  try {
    const colsQ = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='panel_files'`);
    const cols = colsQ.rows.map(r => r.column_name);
    const safe = ['id', 'title', 'description', 'version', 'file_size', 'update_date', 'thumbnail', 'file_path', 'original_filename', 'created_at']
      .filter(c => cols.includes(c));
    const result = await pool.query(`SELECT ${safe.join(',')} FROM panel_files ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Public endpoint: get all media for a panel
router.get('/panels/:id/media', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM panel_media WHERE panel_file_id=$1 ORDER BY display_order, created_at',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/sections', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sections ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/panels-by-section', async (req, res) => {
  try {
    const sections = await pool.query('SELECT * FROM sections ORDER BY name');
    const panels = await pool.query('SELECT * FROM panels WHERE is_active=true ORDER BY name');
    const result = sections.rows.map(s => ({ ...s, panels: panels.rows.filter(p => p.section_id === s.id) }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/orders', authMiddleware, proofUpload.single('proof'), async (req, res) => {
  try {
    const { panel_id, duration, platform, total_price, payment_method, proof_note } = req.body;
    const user_id = req.user.id;
    let proofImage = '';
    if (req.file) proofImage = `/uploads/${req.file.filename}`;

    const colsQ = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='orders'`);
    const cols = colsQ.rows.map(r => r.column_name);
    const hasProof = cols.includes('proof_image');
    const hasNote = cols.includes('proof_note');

    let query, params;
    if (hasProof && hasNote) {
      query = 'INSERT INTO orders (user_id,panel_id,duration,platform,total_price,payment_method,status,proof_image,proof_note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *';
      params = [user_id, panel_id, duration, platform, total_price, payment_method || '', 'pending', proofImage, proof_note || ''];
    } else {
      query = 'INSERT INTO orders (user_id,panel_id,duration,platform,total_price,payment_method,status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *';
      params = [user_id, panel_id, duration, platform, total_price, payment_method || '', 'pending'];
    }

    const result = await pool.query(query, params);
    if (pushNotify) {
      try { await pushNotify.sendNewOrderNotification(result.rows[0]); } catch (e) { /* ignore */ }
    }
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/orders', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
