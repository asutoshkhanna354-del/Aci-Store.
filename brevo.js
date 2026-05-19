const https = require('https');

async function sendOtpEmail(toEmail, otp) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY not configured');

  const body = JSON.stringify({
    sender: { name: 'Verification', email: 'asutoshkhanna354@gmail.com' },
    to: [{ email: toEmail }],
    subject: 'Your Verification Code',
    htmlContent: `
      <!DOCTYPE html>
      <html>
        <body style="margin:0;padding:0;background:#0b0b12;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0b12;padding:40px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:linear-gradient(180deg,#15151f 0%,#0f0f17 100%);border:1px solid rgba(168,85,247,0.18);border-radius:18px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.45);">
                  <tr>
                    <td style="padding:40px 32px 24px;text-align:center;background:radial-gradient(ellipse at top,rgba(168,85,247,0.25) 0%,transparent 70%);">
                      <div style="display:inline-block;width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,#7c3aed,#a855f7);box-shadow:0 12px 32px rgba(124,58,237,0.45);line-height:64px;font-size:30px;">🔐</div>
                      <h1 style="margin:24px 0 6px;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.3px;">Verify your email</h1>
                      <p style="margin:0;color:rgba(255,255,255,0.55);font-size:14px;">Use the code below to continue</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 32px 16px;">
                      <div style="background:#0a0a12;border:1px dashed rgba(168,85,247,0.45);border-radius:14px;padding:26px 16px;text-align:center;">
                        <div style="font-size:11px;letter-spacing:3px;color:rgba(255,255,255,0.45);text-transform:uppercase;margin-bottom:10px;">Your code</div>
                        <div style="font-size:40px;font-weight:900;letter-spacing:14px;color:#a855f7;font-family:'Courier New',monospace;">${otp}</div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 32px 32px;">
                      <p style="margin:0 0 12px;color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;text-align:center;">This code expires in <strong style="color:#fff;">10 minutes</strong>.</p>
                      <p style="margin:0;color:rgba(255,255,255,0.35);font-size:12px;line-height:1.6;text-align:center;">If you didn't request this, you can safely ignore this email.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
                      <p style="margin:0;color:rgba(255,255,255,0.25);font-size:11px;">This is an automated message. Please do not reply.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data));
        else reject(new Error(`Brevo error ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { sendOtpEmail };
