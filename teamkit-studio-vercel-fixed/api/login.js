module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const password = String(body.password || '');
  const expected = process.env.ADMIN_PASSWORD || 'admin123';

  if (password && password === expected) {
    return res.status(200).json({ ok: true, token: expected });
  }

  return res.status(401).json({ error: 'Invalid admin password.' });
};
