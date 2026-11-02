// Shared helpers for the API routes. Secrets live only in Vercel environment variables.
const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function headers(extra) {
  const h = { apikey: KEY, 'Content-Type': 'application/json', ...extra };
  if (KEY && KEY.startsWith('eyJ')) h.Authorization = 'Bearer ' + KEY; // legacy service_role JWT
  return h;
}
async function sb(path, opt = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    method: opt.method || 'GET',
    headers: headers(opt.prefer ? { Prefer: opt.prefer } : {}),
    body: opt.body ? JSON.stringify(opt.body) : undefined,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`supabase ${r.status}: ${t}`);
  return t ? JSON.parse(t) : null;
}
async function tg(method, payload) {
  const T = process.env.TELEGRAM_BOT_TOKEN;
  if (!T) return null;
  const r = await fetch(`https://api.telegram.org/bot${T}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return r.json().catch(() => null);
}
async function notify(text) {
  const ids = (process.env.NOTIFY_CHAT_IDS || '').split(/[,\s]+/).filter(Boolean);
  await Promise.all(ids.map(id => tg('sendMessage', { chat_id: id, text, parse_mode: 'HTML', disable_web_page_preview: true })));
}
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const normCode = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
const pub = g => ({ name: g.name, greet: g.greet, seats: g.seats, table: g.table_no, status: g.status,
  coming: g.coming, lang: g.lang, note: g.note, remind: !!g.tg_chat_id });
function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}
const ip = req => (String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || 'unknown';
// brute-force guard for 4-symbol codes: 20 wrong tries per 10 minutes per IP
async function tooMany(req) {
  const since = new Date(Date.now() - 10 * 60e3).toISOString();
  const rows = await sb(`attempts?select=id&ip=eq.${encodeURIComponent(ip(req))}&at=gte.${since}`);
  return rows.length >= 20;
}
const fail = req => sb('attempts', { method: 'POST', body: { ip: ip(req) }, prefer: 'return=minimal' });
async function getGuest(code) {
  if (!code || code.length < 4) return null;
  const rows = await sb(`guests?code=eq.${encodeURIComponent(code)}&select=*`);
  return rows[0] || null;
}
const site = req => process.env.SITE_URL || `https://${req.headers.host}`;
module.exports = { sb, tg, notify, esc, normCode, pub, body, ip, tooMany, fail, getGuest, site };
