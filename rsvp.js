// POST /api/rsvp {c, status:'yes'|'no', coming} — for a shared invitation also {d: device id, name}
const L = require('./_lib');
const GR = require('./_group');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const b = L.body(req);
    const g = await L.getGuest(L.normCode(b.c));
    if (!g) return res.status(404).json({ error: 'not_found' });
    const status = b.status === 'yes' ? 'yes' : b.status === 'no' ? 'no' : null;
    if (!status) return res.status(400).json({ error: 'bad_request' });
    const t = g.table_no ? ` · стол ${g.table_no}` : '';
    if (g.kind === 'group') {
      const d = GR.dev(b.d), name = String(b.name || '').trim().slice(0, 80);
      if (!d || !name) return res.status(400).json({ error: 'name_required' });
      const coming = status === 'yes' ? Math.max(1, Math.min(5, parseInt(b.coming, 10) || 1)) : 0;
      await L.sb('group_answers?on_conflict=guest_id,device', { method: 'POST', body: [{ guest_id: g.id, device: d, name, coming, updated_at: new Date().toISOString() }], prefer: 'resolution=merge-duplicates,return=minimal' });
      const sum = await GR.recount(g);
      await L.notify(status === 'yes'
        ? `✅ <b>${L.esc(name)}</b> (${L.esc(g.name)}) придёт: ${coming}${t}\nВсего по общему приглашению: ${sum.coming} из ${g.seats}`
        : `❌ <b>${L.esc(name)}</b> (${L.esc(g.name)}) не сможет прийти`);
      return res.json({ ok: true, status, coming });
    }
    const coming = status === 'yes' ? Math.max(1, Math.min(g.seats, parseInt(b.coming, 10) || 1)) : 0;
    await L.sb(`guests?id=eq.${g.id}`, { method: 'PATCH', body: { status, coming, answered_at: new Date().toISOString() }, prefer: 'return=minimal' });
    await L.notify(status === 'yes'
      ? `✅ <b>${L.esc(g.name)}</b> придут: ${coming} из ${g.seats}${t}`
      : `❌ <b>${L.esc(g.name)}</b> не смогут прийти`);
    res.json({ ok: true, status, coming });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server' }); }
};
