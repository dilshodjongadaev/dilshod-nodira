// GET /api/invite?c=CODE — the guest's personal invitation data
const L = require('./_lib');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const code = L.normCode(req.query.c);
    if (await L.tooMany(req)) return res.status(429).json({ error: 'too_many' });
    const g = await L.getGuest(code);
    if (!g) { await L.fail(req); return res.status(404).json({ error: 'not_found' }); }
    if (g.status === 'none') {
      await L.sb(`guests?id=eq.${g.id}`, { method: 'PATCH', body: { status: 'opened', opened_at: new Date().toISOString() }, prefer: 'return=minimal' });
      g.status = 'opened';
    }
    const wishes = await L.sb(`wishes?guest_id=eq.${g.id}&select=text,created_at&order=created_at`);
    res.json({ guest: L.pub(g), wishes: wishes.map(w => ({ text: w.text, at: w.created_at })), bot: process.env.TELEGRAM_BOT_USERNAME || '' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server' }); }
};
