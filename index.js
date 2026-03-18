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

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/store', require('./routes/storeRoutes'));
app.use('/api/reseller', require('./routes/resellerRoutes'));

// Uploads (temporary, not persistent on Render)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Start server
const PORT = process.env.PORT || 5000;

async function start() {
  try {
    // Run schema (only once ideally)
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);

    console.log('Database connected');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error('Startup error:', err);
  }
}

start();
