const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ff_panel_secret_key_2024';

function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      is_admin: user.is_admin || !!user.role,
      role: user.role || (user.is_admin ? 'main_admin' : null),
      permissions: user.permissions || {}
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function generateResellerToken(reseller) {
  return jwt.sign(
    { id: reseller.id, username: reseller.username, is_reseller: true },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function resellerMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.is_reseller) return res.status(403).json({ error: 'Reseller access required' });
    req.reseller = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function adminMiddleware(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'Admin access required' });
  next();
}

module.exports = { generateToken, generateResellerToken, authMiddleware, resellerMiddleware, adminMiddleware, JWT_SECRET };
