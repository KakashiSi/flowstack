export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://pflow.org');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });

  const results = {};

  // Beehiiv — primary (configure BEEHIIV_API_KEY + BEEHIIV_PUB_ID in Vercel env vars)
  if (process.env.BEEHIIV_API_KEY && process.env.BEEHIIV_PUB_ID) {
    try {
      const r = await fetch(
        `https://api.beehiiv.com/v2/publications/${process.env.BEEHIIV_PUB_ID}/subscriptions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.BEEHIIV_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            reactivate_existing: true,
            send_welcome_email: true,
          }),
        }
      );
      results.beehiiv = r.ok ? 'ok' : await r.text();
    } catch (e) {
      results.beehiiv = 'error: ' + e.message;
    }
  } else {
    results.beehiiv = 'not configured — add BEEHIIV_API_KEY and BEEHIIV_PUB_ID to Vercel env';
  }

  // Resend — notify owner on every new subscriber
  if (process.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'FlowStack <hello@pflow.org>',
          to: 'mike@sieng.digital',
          subject: `New subscriber: ${email}`,
          text: `New FlowStack subscriber: ${email}\n\nTimestamp: ${new Date().toISOString()}`,
        }),
      });
    } catch (_) {}
  }

  return res.status(200).json({ ok: true, results });
}
