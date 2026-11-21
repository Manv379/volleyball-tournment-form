const crypto = require('crypto');
const { getAllOrders, saveAllOrders, isPersistentStorageEnabled } = require('./_storage');

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || 'admin123';
}

function isAuthorized(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  return token && token === getAdminPassword();
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  try {
    // POST /api/orders -> Public submission from team order form
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

      const teamName = String(body.teamName || '').trim();
      const contactEmail = String(body.contactEmail || '').trim();
      const contactPhone = String(body.contactPhone || '').trim();
      const notes = String(body.notes || '').trim();
      const color = body.color && typeof body.color === 'object' ? body.color : { name: 'Slate Navy', hex: '#1e293b', dark: true };
      const placement = String(body.placement || 'left-chest');
      const scale = Number(body.scale) || 1;
      const yOffset = Number(body.yOffset) || 0;
      const logoDataUrl = typeof body.logoDataUrl === 'string' && body.logoDataUrl.startsWith('data:image/')
        ? body.logoDataUrl
        : '';

      const rawPlayers = Array.isArray(body.players) ? body.players : [];
      const players = rawPlayers
        .map((p, idx) => ({
          id: idx + 1,
          name: String(p.name || '').trim().toUpperCase().slice(0, 24),
          number: String(p.number || '').trim().slice(0, 4),
          size: String(p.size || 'L').trim().toUpperCase().slice(0, 6)
        }))
        .filter((p) => p.name || p.number);

      if (!teamName) {
        return res.status(400).json({ error: 'Team name is required.' });
      }
      if (players.length === 0) {
        return res.status(400).json({ error: 'At least one player entry is required.' });
      }

      // Limit base64 payload size (~1.5 MB) to keep requests fast
      if (logoDataUrl.length > 2_000_000) {
        return res.status(413).json({ error: 'Uploaded logo is too large. Please use an image under 1.2 MB.' });
      }

      const newOrder = {
        id: 'ORD-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
        createdAt: new Date().toISOString(),
        status: 'New',
        teamName,
        contactEmail,
        contactPhone,
        notes,
        color,
        placement,
        scale,
        yOffset,
        logoDataUrl,
        players
      };

      const orders = await getAllOrders();
      orders.unshift(newOrder);
      await saveAllOrders(orders);

      return res.status(201).json({
        ok: true,
        orderId: newOrder.id,
        persistent: isPersistentStorageEnabled()
      });
    }

    // Admin-protected routes below
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: 'Unauthorized. Invalid admin password.' });
    }

    // GET /api/orders -> List all orders for Admin Dashboard
    if (req.method === 'GET') {
      const orders = await getAllOrders();
      return res.status(200).json({
        ok: true,
        persistent: isPersistentStorageEnabled(),
        orders
      });
    }

    // PATCH /api/orders -> Update order status (New, In Production, Completed)
    if (req.method === 'PATCH') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { id, status } = body;
      const allowed = ['New', 'In Production', 'Completed', 'Cancelled'];
      if (!id || !allowed.includes(status)) {
        return res.status(400).json({ error: 'Valid order id and status are required.' });
      }

      const orders = await getAllOrders();
      const idx = orders.findIndex((o) => o.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: 'Order not found.' });
      }

      orders[idx].status = status;
      orders[idx].updatedAt = new Date().toISOString();
      await saveAllOrders(orders);

      return res.status(200).json({ ok: true, order: orders[idx] });
    }

    // DELETE /api/orders?id=ORD-XXXX -> Delete an order
    if (req.method === 'DELETE') {
      const id = (req.query && req.query.id) || '';
      if (!id) {
        return res.status(400).json({ error: 'Order id is required.' });
      }

      const orders = await getAllOrders();
      const filtered = orders.filter((o) => o.id !== id);
      await saveAllOrders(filtered);

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API /api/orders error:', err);
    return res.status(500).json({ error: 'Internal server error: ' + err.message });
  }
};
