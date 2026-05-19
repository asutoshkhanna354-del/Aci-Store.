const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const pool = require('./db');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
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

async function runSchema() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  // Split on semicolons but keep DO $$ ... END $$; blocks intact
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  for (let i = 0; i < schema.length; i++) {
    current += schema[i];
    if (schema.slice(i, i + 2) === '$$') {
      inDollarQuote = !inDollarQuote;
    }
    if (schema[i] === ';' && !inDollarQuote) {
      const stmt = current.trim();
      if (stmt && stmt !== ';') statements.push(stmt);
      current = '';
    }
  }
  if (current.trim()) statements.push(current.trim());

  for (const stmt of statements) {
    try {
      await pool.query(stmt);
    } catch (err) {
      // Log but don't crash — migration errors shouldn't kill the server
      console.warn('Schema stmt warning (non-fatal):', err.message);
    }
  }
}

async function start() {
  try {
    await runSchema();
    console.log('Schema migration complete');
  } catch (err) {
    console.warn('Schema migration warning:', err.message);
  }

  try {
    require('./seed');
  } catch (err) {
    console.warn('Seed warning:', err.message);
  }

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
