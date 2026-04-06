fetch('https://gestor-app-ashy.vercel.app/api/v1/telegram-webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: {
      chat: { id: 123456 },
      text: '/start'
    }
  })
}).then(async r => {
  console.log('Status:', r.status)
  console.log('Text:', await r.text())
})
