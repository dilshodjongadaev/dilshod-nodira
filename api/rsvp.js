// POST /api/rsvp {c, status:'yes'|'no', coming}
const L = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const b = L.body(req);
    const g = await L.getGuest(L.normCode(b.c));
    if (!g) return res.status(404).json({ error: 'not_found' });
    const status = b.status === 'yes' ? 'yes' : b.status === 'no' ? 'no' : null;
    if (!status) return res.status(400).json({ error: 'bad_request' });
    const coming = status === 'yes' ? Math.max(1, Math.min(g.seats, parseInt(b.coming, 10) || 1)) : 0;
    await L.sb(`guests?id=eq.${g.id}`, { method: 'PATCH', body: { status, coming, answered_at: new Date().toISOString() }, prefer: 'return=minimal' });
    const t = g.table_no ? ` · стол ${g.table_no}` : '';
    await L.notify(status === 'yes'
      ? `✅ <b>${L.esc(g.name)}</b> придут: ${coming} из ${g.seats}${t}`
      : `❌ <b>${L.esc(g.name)}</b> не смогут прийти`);
    res.json({ ok: true, status, coming });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server' }); }
};
