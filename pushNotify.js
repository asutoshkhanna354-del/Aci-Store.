const webpush = require('web-push');
const pool = require('./db');

let configured = false;

async function configure() {
  if (configured) return;
  try {
    const pubRes = await pool.query("SELECT value FROM settings WHERE key = 'vapid_public_key'");
    const privRes = await pool.query("SELECT value FROM settings WHERE key = 'vapid_private_key'");
    if (pubRes.rows.length && privRes.rows.length) {
      webpush.setVapidDetails(
        'mailto:admin@acistore.com',
        pubRes.rows[0].value,
        privRes.rows[0].value
      );
      configured = true;
    }
  } catch (err) {
    console.error('Push config error:', err.message);
  }
}

async function sendPushToAdmins(title, body, url) {
  try {
    const notifEnabled = await pool.query("SELECT value FROM settings WHERE key = 'notifications_enabled'");
    if (notifEnabled.rows.length && notifEnabled.rows[0].value !== 'true') return;

    await configure();
    if (!configured) return;

    const admins = await pool.query('SELECT id FROM users WHERE is_admin = true');
    const adminIds = admins.rows.map(a => a.id);
    if (adminIds.length === 0) return;

    const subs = await pool.query(
      'SELECT * FROM push_subscriptions WHERE user_id = ANY($1)',
      [adminIds]
    );

    const payload = JSON.stringify({ title, body, url: url || '/admin/orders', tag: 'order-' + Date.now() });

    for (const sub of subs.rows) {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth }
      };
      try {
        await webpush.sendNotification(pushSub, payload);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
        }
      }
    }
  } catch (err) {
    console.error('Push send error:', err.message);
  }
}

module.exports = { sendPushToAdmins };
