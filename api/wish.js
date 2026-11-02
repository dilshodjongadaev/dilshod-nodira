// POST /api/wish {c, text} — private wish, only the couple sees it
const L = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const b = L.body(req);
    const text = String(b.text || '').trim().slice(0, 1000);
    if (text.length < 2) return res.status(400).json({ error: 'too_short' });
    const g = await L.getGuest(L.normCode(b.c));
    if (!g) return res.status(404).json({ error: 'not_found' });
    await L.sb('wishes', { method: 'POST', body: { guest_id: g.id, text }, prefer: 'return=minimal' });
    await L.notify(`💌 <b>${L.esc(g.name)}</b>:\n${L.esc(text)}`);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server' }); }
};
