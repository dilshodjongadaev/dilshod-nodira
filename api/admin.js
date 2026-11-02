// POST /api/admin — the couple's panel. Protected by ADMIN_PASSWORD (header x-admin-key).
const L = require('./_lib');
const FIELDS = ['code', 'name', 'greet', 'seats', 'table_no', 'lang', 'side', 'grp', 'line', 'note'];
const pick = f => Object.fromEntries(Object.entries(f || {}).filter(([k]) => FIELDS.includes(k)));
function clean(f) {
  const o = pick(f);
  if ('code' in o) o.code = L.normCode(o.code);
  if ('seats' in o) o.seats = Math.max(1, Math.min(20, parseInt(o.seats, 10) || 1));
  if ('table_no' in o) o.table_no = o.table_no ? parseInt(o.table_no, 10) : null;
  if ('name' in o) o.name = String(o.name).trim().slice(0, 120);
  if ('note' in o) o.note = o.note ? String(o.note).slice(0, 600) : null;
  return o;
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  if (!process.env.ADMIN_PASSWORD || req.headers['x-admin-key'] !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'auth' });
  const b = L.body(req);
  try {
    switch (b.action) {
      case 'list': {
        const [guests, wishes] = await Promise.all([
          L.sb('guests?select=*&order=id'),
          L.sb('wishes?select=id,guest_id,text,created_at&order=created_at'),
        ]);
        return res.json({ guests, wishes, bot: process.env.TELEGRAM_BOT_USERNAME || '' });
      }
      case 'save': {
        const f = clean(b.fields);
        if (b.id) { const r = await L.sb(`guests?id=eq.${parseInt(b.id, 10)}`, { method: 'PATCH', body: f, prefer: 'return=representation' }); return res.json({ guest: r[0] }); }
        if (!f.code || !f.name) return res.status(400).json({ error: 'code_and_name_required' });
        const r = await L.sb('guests', { method: 'POST', body: f, prefer: 'return=representation' });
        return res.json({ guest: r[0] });
      }
      case 'import': {
        const rows = (b.rows || []).map(clean).filter(r => r.code && r.name);
        if (!rows.length) return res.status(400).json({ error: 'empty' });
        const r = await L.sb('guests?on_conflict=code', { method: 'POST', body: rows, prefer: 'resolution=merge-duplicates,return=representation' });
        return res.json({ imported: r.length });
      }
      case 'delete': {
        await L.sb(`guests?id=eq.${parseInt(b.id, 10)}`, { method: 'DELETE', prefer: 'return=minimal' });
        return res.json({ ok: true });
      }
      case 'setup': {
        const url = `${L.site(req)}/api/telegram`;
        const hook = await L.tg('setWebhook', { url, secret_token: process.env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ['message'] });
        const me = await L.tg('getMe', {});
        await L.notify('✅ Бот подключён. Сюда будут приходить ответы гостей и пожелания.');
        return res.json({ hook, me });
      }
      default: return res.status(400).json({ error: 'unknown_action' });
    }
  } catch (e) {
    console.error(e);
    const dup = /duplicate key|23505/.test(String(e.message));
    return res.status(dup ? 409 : 500).json({ error: dup ? 'duplicate_code' : 'server' });
  }
};
