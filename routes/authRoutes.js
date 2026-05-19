const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { generateToken, authMiddleware } = require('../auth');
const { sendOtpEmail } = require('../brevo');

const router = express.Router();

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already registered' });

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query('DELETE FROM email_otps WHERE email = $1', [email]);
    await pool.query(
      'INSERT INTO email_otps (email, otp, expires_at) VALUES ($1, $2, $3)',
      [email, otp, expiresAt]
    );

    await sendOtpEmail(email, otp);
    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

    const result = await pool.query(
      'SELECT * FROM email_otps WHERE email = $1 AND otp = $2 AND verified = FALSE AND expires_at > NOW()',
      [email, otp]
    );

    if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired OTP' });

    await pool.query('UPDATE email_otps SET verified = TRUE WHERE email = $1', [email]);
    res.json({ success: true, message: 'Email verified' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, telegram_username } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });

    const otpCheck = await pool.query(
      'SELECT id FROM email_otps WHERE email = $1 AND verified = TRUE',
      [email]
    );
    if (otpCheck.rows.length === 0) return res.status(400).json({ error: 'Please verify your email with OTP first' });

    const exists = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (exists.rows.length > 0) return res.status(400).json({ error: 'Username or email already exists' });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password, telegram_username) VALUES ($1, $2, $3, $4) RETURNING id, username, email, is_admin, telegram_username',
      [username, email, hash, telegram_username || '']
    );

    await pool.query('DELETE FROM email_otps WHERE email = $1', [email]);

    const user = result.rows[0];
    const token = generateToken(user);
    res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'All fields required' });

    let result = await pool.query('SELECT id, username, password, role, permissions FROM admins WHERE username = $1', [username]);
    let user;
    let isAdmin = false;

    if (result.rows.length > 0) {
      user = result.rows[0];
      isAdmin = true;
    } else {
      result = await pool.query('SELECT id, username, password, email, telegram_username, is_admin FROM users WHERE username = $1', [username]);
      if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid credentials' });
      user = result.rows[0];
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    const token = generateToken({ ...user, is_admin: isAdmin || user.is_admin });
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email || '',
        is_admin: isAdmin || user.is_admin,
        role: user.role || (user.is_admin ? 'main_admin' : null),
        permissions: user.permissions || {},
        telegram_username: user.telegram_username || ''
      },
      token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    let adminResult = await pool.query('SELECT id, username, role, permissions FROM admins WHERE id = $1', [req.user.id]);
    if (adminResult.rows.length > 0) {
      const admin = adminResult.rows[0];
      return res.json({
        id: admin.id,
        username: admin.username,
        is_admin: true,
        role: admin.role,
        permissions: admin.permissions || {},
        email: '',
        telegram_username: ''
      });
    }

    const result = await pool.query('SELECT id, username, email, is_admin, telegram_username, created_at FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = result.rows[0];
    res.json({
      ...user,
      role: user.is_admin ? 'main_admin' : null,
      permissions: {}
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { telegram_username, email } = req.body;
    await pool.query('UPDATE users SET telegram_username = COALESCE($1, telegram_username), email = COALESCE($2, email) WHERE id = $3',
      [telegram_username, email, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
