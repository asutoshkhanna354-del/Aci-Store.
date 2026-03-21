try { require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') }); } catch(e) {}
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const pool = require('./db');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const storeRoutes = require('./routes/storeRoutes');
const resellerRoutes = require('./routes/resellerRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/reseller', resellerRoutes);

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
  }
}));

app.get('/uploads/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const img = await pool.query(
      'SELECT file_data, mime_type, media_type FROM panel_images WHERE filename = $1 AND file_data IS NOT NULL LIMIT 1',
      [filename]
    );
    if (img.rows.length > 0 && img.rows[0].file_data) {
      const row = img.rows[0];
      res.setHeader('Content-Type', row.mime_type || (row.media_type === 'video' ? 'video/mp4' : 'image/jpeg'));
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      return res.send(row.file_data);
    }
    const proof = await pool.query(
      'SELECT payment_proof_data, payment_proof_mime FROM orders WHERE payment_proof_image = $1 AND payment_proof_data IS NOT NULL LIMIT 1',
      [filename]
    );
    if (proof.rows.length > 0 && proof.rows[0].payment_proof_data) {
      res.setHeader('Content-Type', proof.rows[0].payment_proof_mime || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      return res.send(proof.rows[0].payment_proof_data);
    }
    const branding = await pool.query(
      "SELECT key, value FROM settings WHERE key LIKE 'branding_%' AND key NOT LIKE '%_data' AND key NOT LIKE '%_mime' AND value = $1 LIMIT 1",
      [filename]
    );
    if (branding.rows.length > 0) {
      const brandKey = branding.rows[0].key;
      const dataRow = await pool.query("SELECT value FROM settings WHERE key = $1", [brandKey + '_data']);
      const mimeRow = await pool.query("SELECT value FROM settings WHERE key = $1", [brandKey + '_mime']);
      if (dataRow.rows.length > 0) {
        res.setHeader('Content-Type', mimeRow.rows[0]?.value || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        return res.send(Buffer.from(dataRow.rows[0].value, 'base64'));
      }
    }
    const pf = await pool.query(
      'SELECT file_data, file_mime, thumb_data, thumb_mime, file_path, thumbnail FROM panel_files WHERE (file_path = $1 OR thumbnail = $1) AND (file_data IS NOT NULL OR thumb_data IS NOT NULL) LIMIT 1',
      [filename]
    );
    if (pf.rows.length > 0) {
      const row = pf.rows[0];
      if (row.file_path === filename && row.file_data) {
        res.setHeader('Content-Type', row.file_mime || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        return res.send(row.file_data);
      }
      if (row.thumbnail === filename && row.thumb_data) {
        res.setHeader('Content-Type', row.thumb_mime || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        return res.send(row.thumb_data);
      }
    }
    res.status(404).send('File not found');
  } catch (err) {
    res.status(500).send('Error loading file');
  }
});

app.use(express.static(path.join(__dirname, '..', 'client', 'dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Service-Worker-Allowed', '/');
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

app.get('/{*splat}', (req, res) => {
  const indexPath = path.join(__dirname, '..', 'client', 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('Building frontend... please wait and refresh.');
  }
});

async function start() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);

  const seed = require('./seed');

  const PORT = 5000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch(console.error);
