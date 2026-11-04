// Vercel Cron, 25 Nov 12:00 Tashkent: remind every confirmed guest who subscribed in Telegram
const L = require('./_lib');
function message(g, url) {
  const t = g.table_no;
  if (g.lang === 'uzl') return `Ertaga bizning to‘yimiz! 💍\n26-noyabr soat 18:00 da «Maroqand» to‘yxonasida (Hidoyatov ko‘chasi, 20A) sizni kutamiz.${t ? `\nStolingiz № ${t}.` : ''}\n\nDilshodjon va Nodira\n${url}`;
  if (g.lang === 'uzc') return `Эртага бизнинг тўйимиз! 💍\n26-ноябр соат 18:00 да «Мароқанд» тўйхонасида (Ҳидоятов кўчаси, 20А) сизни кутамиз.${t ? `\nСтолингиз № ${t}.` : ''}\n\nДилшоджон ва Нодира\n${url}`;
  return `Завтра наша свадьба! 💍\nЖдём вас 26 ноября в 18:00, свадебный ресторан «Maroqand», ул. Хидоятова, 20А.${t ? `\nВаш стол № ${t}.` : ''}\n\nДилшоджон и Нодира\n${url}`;
}
module.exports = async (req, res) => {
  const okCron = process.env.CRON_SECRET && req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const okAdmin = process.env.ADMIN_PASSWORD && req.headers['x-admin-key'] === process.env.ADMIN_PASSWORD;
  if (!okCron && !okAdmin) return res.status(401).end();
  try {
    const list = await L.sb('guests?status=eq.yes&tg_chat_id=not.is.null&reminded_at=is.null&select=*');
    let sent = 0;
    for (const g of list) {
      const r = await L.tg('sendMessage', { chat_id: g.tg_chat_id, text: message(g, `${L.site(req)}/?c=${g.code}`), disable_web_page_preview: true });
      if (r && r.ok) { sent++; await L.sb(`guests?id=eq.${g.id}`, { method: 'PATCH', body: { reminded_at: new Date().toISOString() }, prefer: 'return=minimal' }); }
    }
    await L.notify(`🔔 Напоминания отправлены: ${sent} из ${list.length}`);
    res.json({ ok: true, sent, total: list.length });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server' }); }
};
