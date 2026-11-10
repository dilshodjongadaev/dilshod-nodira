// Telegram webhook: a guest taps "Remind me" -> t.me/<bot>?start=CODE -> we remember their chat
const L = require('./_lib');
const TXT = {
  ru: 'Спасибо! 25 ноября мы напомним вам о свадьбе 💍',
  uzl: 'Rahmat! 25-noyabr kuni sizga to‘y haqida eslatamiz 💍',
  uzc: 'Раҳмат! 25-ноябр куни сизга тўй ҳақида эслатамиз 💍',
};
module.exports = async (req, res) => {
  if (req.headers['x-telegram-bot-api-secret-token'] !== process.env.TELEGRAM_WEBHOOK_SECRET) return res.status(401).end();
  try {
    const m = (L.body(req) || {}).message;
    if (!m || !m.text) return res.json({ ok: true });
    const start = m.text.match(/^\/start(?:\s+(\S+))?/);
    if (start) {
      const g = await L.getGuest(L.normCode(start[1]));
      if (g) {
        await L.sb(`guests?id=eq.${g.id}`, { method: 'PATCH', body: { tg_chat_id: m.chat.id }, prefer: 'return=minimal' });
        await L.tg('sendMessage', { chat_id: m.chat.id, text: TXT[g.lang] || TXT.ru });
      } else {
        await L.tg('sendMessage', { chat_id: m.chat.id, text: 'Здравствуйте! Это бот свадьбы Дилшоджона и Нодиры 💍\nОткройте своё приглашение и нажмите «Напомнить в Telegram».\n\nAssalomu alaykum! Taklifnomangizni oching va «Telegramda eslatish» tugmasini bosing.' });
      }
    }
    res.json({ ok: true });
  } catch (e) { console.error(e); res.json({ ok: true }); }
};
