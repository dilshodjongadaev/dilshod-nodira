// helpers for shared ("group") invitations: every visitor answers for themselves
const L = require('./_lib');
const dev = d => (typeof d === 'string' && /^[A-Za-z0-9_-]{8,40}$/.test(d)) ? d : null;
async function mine(g, d) {
  if (!d) return null;
  const r = await L.sb(`group_answers?guest_id=eq.${g.id}&device=eq.${d}&select=name,coming`);
  return r[0] || null;
}
async function recount(g) {
  const a = await L.sb(`group_answers?guest_id=eq.${g.id}&select=coming`);
  const coming = a.reduce((s, x) => s + x.coming, 0);
  const status = coming > 0 ? 'yes' : a.length ? 'no' : (g.status === 'none' ? 'none' : 'opened');
  await L.sb(`guests?id=eq.${g.id}`, { method: 'PATCH', body: { status, coming, answered_at: new Date().toISOString() }, prefer: 'return=minimal' });
  return { coming, status, answers: a.length };
}
module.exports = { dev, mine, recount };
