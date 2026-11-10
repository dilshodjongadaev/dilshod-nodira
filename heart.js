// POST /api/heart {answer:'yes', text} — Nodira's reply from her personal page goes straight to Dilshodjon's Telegram
const L = require('./_lib');
// only Dilshodjon gets these (the first Id in NOTIFY_CHAT_IDS), so the surprise stays a surprise
const toGroom = text => { const id = String(process.env.NOTIFY_CHAT_IDS || '').split(',')[0].trim(); return id ? L.tg('sendMessage', { chat_id: id, text, parse_mode: 'HTML' }) : null; };
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    if (await L.tooMany(req)) return res.status(429).json({ error: 'too_many' });
    await L.fail(req); // every message counts toward the per-IP limit, so the page can't be used for spam
    const b = L.body(req);
    const text = String(b.text || '').trim().slice(0, 1000);
    if (b.answer === 'yes' && !text) await toGroom('💍 <b>Нодира открыла твоё приглашение и нажала «Принимаю» 💜</b>');
    else if (b.coupon) await toGroom(`🎟 <b>Нодира использовала купон:</b>\n«${L.esc(String(b.coupon).slice(0, 200))}»`);
    else if (text) await toGroom(`💌 <b>Нодира пишет тебе:</b>\n${L.esc(text)}`);
    else return res.status(400).json({ error: 'empty' });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server' }); }
};
