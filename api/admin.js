// POST /api/admin — the couple's panel. Protected by ADMIN_PASSWORD (header x-admin-key).
const L = require('./_lib');
const FIELDS = ['code', 'name', 'greet', 'seats', 'table_no', 'lang', 'side', 'grp', 'line', 'note', 'part', 'name_uz', 'kind'];
const pick = f => Object.fromEntries(Object.entries(f || {}).filter(([k]) => FIELDS.includes(k)));
function clean(f) {
  const o = pick(f);
  if ('code' in o) o.code = L.normCode(o.code);
  if ('seats' in o) o.seats = Math.max(1, Math.min(20, parseInt(o.seats, 10) || 1));
  if ('table_no' in o) o.table_no = o.table_no ? parseInt(o.table_no, 10) : null;
  if ('name' in o) o.name = String(o.name).trim().slice(0, 120);
  if ('note' in o) o.note = o.note ? String(o.note).slice(0, 600) : null;
  if ('part' in o) o.part = o.part === 'm' ? 'm' : 'w';
  if ('kind' in o) o.kind = o.kind === 'group' ? 'group' : 'one';
  if ('name_uz' in o) o.name_uz = o.name_uz ? String(o.name_uz).trim().slice(0, 120) : null;
  return o;
}
const RESET = { status: 'none', coming: 0, tg_chat_id: null, opened_at: null, answered_at: null, reminded_at: null };
async function retired(codes) {
  const ok = codes.filter(c => /^[A-Z0-9]{4,6}$/.test(c));
  if (!ok.length) return new Set();
  const r = await L.sb(`retired_codes?select=code&code=in.(${ok.join(',')})`);
  return new Set(r.map(x => x.code));
}
const retire = code => L.sb('retired_codes?on_conflict=code', { method: 'POST', body: [{ code }], prefer: 'resolution=ignore-duplicates,return=minimal' });
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  if (!process.env.ADMIN_PASSWORD || req.headers['x-admin-key'] !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: 'auth' });
  const b = L.body(req);
  try {
    switch (b.action) {
      case 'list': {
        const [guests, wishes, ret] = await Promise.all([
          L.sb('guests?select=*&order=id'),
          L.sb('wishes?select=id,guest_id,text,author,created_at&order=created_at').catch(() => L.sb('wishes?select=id,guest_id,text,created_at&order=created_at')),
          L.sb('retired_codes?select=code').catch(() => []),
        ]);
        const [answers, set] = await Promise.all([
          L.sb('group_answers?select=guest_id,name,coming,updated_at&order=updated_at').catch(() => []),
          L.sb('settings?key=eq.letter&select=value').catch(() => []),
        ]);
        return res.json({ guests, wishes, answers, letter: set[0] ? set[0].value : null, retired: ret.map(x => x.code), bot: process.env.TELEGRAM_BOT_USERNAME || '' });
      }
      case 'letter': {
        const v = b.value || {};
        const s = x => String(x || '').trim().slice(0, 1200);
        const value = { ru: { p1: s(v.ru && v.ru.p1), p2: s(v.ru && v.ru.p2) }, uz: { p1: s(v.uz && v.uz.p1), p2: s(v.uz && v.uz.p2) } };
        const empty = !value.ru.p1 && !value.ru.p2 && !value.uz.p1 && !value.uz.p2;
        if (empty) await L.sb('settings?key=eq.letter', { method: 'DELETE', prefer: 'return=minimal' });
        else await L.sb('settings?on_conflict=key', { method: 'POST', body: [{ key: 'letter', value, updated_at: new Date().toISOString() }], prefer: 'resolution=merge-duplicates,return=minimal' });
        return res.json({ ok: true, letter: empty ? null : value });
      }
      case 'save': {
        const f = clean(b.fields);
        if (f.code && (await retired([f.code])).has(f.code)) return res.status(409).json({ error: 'retired_code' });
        if (b.id) { const r = await L.sb(`guests?id=eq.${parseInt(b.id, 10)}`, { method: 'PATCH', body: f, prefer: 'return=representation' }); return res.json({ guest: r[0] }); }
        if (!f.code || !f.name) return res.status(400).json({ error: 'code_and_name_required' });
        const r = await L.sb('guests', { method: 'POST', body: f, prefer: 'return=representation' });
        return res.json({ guest: r[0] });
      }
      case 'import': {
        const all = (b.rows || []).slice(0, 300).map(clean).filter(r => r.code && r.name);
        const bad = await retired(all.map(r => r.code));
        const rows = all.filter(r => !bad.has(r.code));
        if (!rows.length) return res.json({ imported: 0, skipped: [...bad] });
        const r = await L.sb('guests?on_conflict=code', { method: 'POST', body: rows, prefer: 'resolution=merge-duplicates,return=representation' });
        return res.json({ imported: r.length, skipped: [...bad] });
      }
      case 'delete': {
        const id = parseInt(b.id, 10);
        const g = (await L.sb(`guests?select=code&id=eq.${id}`))[0];
        if (g) await retire(g.code);
        await L.sb(`guests?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
        return res.json({ ok: true });
      }
      case 'reset': {
        await L.sb(`group_answers?guest_id=eq.${parseInt(b.id, 10)}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
        const r = await L.sb(`guests?id=eq.${parseInt(b.id, 10)}`, { method: 'PATCH', body: RESET, prefer: 'return=representation' });
        return res.json({ guest: r[0] });
      }
      case 'recode': {
        const id = parseInt(b.id, 10), code = L.normCode(b.code);
        if (!/^[A-Z0-9]{4,6}$/.test(code)) return res.status(400).json({ error: 'bad_code' });
        if ((await retired([code])).has(code)) return res.status(409).json({ error: 'retired_code' });
        const g = (await L.sb(`guests?select=code&id=eq.${id}`))[0];
        if (!g) return res.status(404).json({ error: 'not_found' });
        const r = await L.sb(`guests?id=eq.${id}`, { method: 'PATCH', body: { code, ...RESET }, prefer: 'return=representation' });
        await retire(g.code);
        await L.sb(`wishes?guest_id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' });
        await L.sb(`group_answers?guest_id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' }).catch(() => {});
        return res.json({ guest: r[0], old: g.code });
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
