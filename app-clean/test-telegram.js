const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = "123456"; // Dummy ID, won't deliver but will test URL
const text = "/start";

async function run() {
  const url = `https://api.telegram.org/bot8469161392:AAETrQWLWzOnCFwmVTxWHsdm20_n_JJQxik/sendMessage`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    console.log(r.status);
    console.log(await r.text());
  } catch (e) {
    console.error(e);
  }
}
run();
