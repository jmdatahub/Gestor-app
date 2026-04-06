import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const telegramToken = process.env.TELEGRAM_BOT_TOKEN || '8469161392:AAETrQWLWzOnCFwmVTxWHsdm20_n_JJQxik'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
})

async function hashToken(token: string): Promise<string> {
  const hash = crypto.createHash('sha256')
  hash.update(token)
  return hash.digest('hex')
}

// Envía un mensaje de vuelta a Telegram
async function sendMessage(chatId: string | number, text: string) {
  const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    })
  } catch (e) {
    console.error('Error sending telegram message', e)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Telegram webhooks use POST
  if (req.method !== 'POST') {
    return res.status(200).send('Bot is active')
  }

  // Do not send 200 OK prematurely in Vercel Serverless
  // Wait for processing to finish before responding

  try {
    const { message } = req.body
    if (!message || !message.text) return
    
    const chatId = message.chat.id.toString()
    const text = message.text.trim()

    // Comando especial para vincular cuenta: /link <sk_live_...>
    if (text.startsWith('/link')) {
      // Limpiamos los < > por si lo metió literal '<sk_live...>' y cortamos por cualquier espacio o intro
      const parts = text.replace(/[<>]/g, '').trim().split(/\s+/)
      if (parts.length < 2) {
        await sendMessage(chatId, '❌ Debes incluir tu token API. Ejemplo: /link sk_live_ABC123')
        return res.status(200).send('OK')
      }
      
      const rawToken = parts[1].trim()
      if (!rawToken.startsWith('sk_live_')) {
        await sendMessage(chatId, '❌ Formato de token inválido. Debe empezar por sk_live_')
        return res.status(200).send('OK')
      }

      // Buscar el token en base de datos
      const tokenHash = await hashToken(rawToken)
      const { data: tokenData, error: tokenError } = await supabase
        .from('api_tokens')
        .select('user_id, organization_id, scopes')
        .eq('token_hash', tokenHash)
        .single()

      if (tokenError || !tokenData) {
        await sendMessage(chatId, '❌ Token no encontrado o expirado. Crea uno en los Ajustes de la App de Gestor.')
        return res.status(200).send('OK')
      }

      if (!tokenData.scopes.includes('movements:write')) {
         await sendMessage(chatId, '❌ Este token no tiene permiso para crear gastos (movements:write). Crea uno con más permisos.')
         return res.status(200).send('OK')
      }

      // Actualizar el perfil del usuario para asociar su Telegram a su User ID
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ telegram_chat_id: chatId })
        .eq('id', tokenData.user_id)

      if (updateError) {
        console.error('Error linking ID', updateError)
        await sendMessage(chatId, '❌ Ocurrió un error al vincular la cuenta a nivel de base de datos.')
        return res.status(200).send('OK')
      }

      await sendMessage(chatId, '✅ ¡Cuenta vinculada con éxito! Ya puedes enviarme tus gastos con formato: "15.50 Cena con amigos"')
      return res.status(200).send('OK')
    }

    // Si es un comando genérico como /start
    if (text === '/start') {
      await sendMessage(chatId, '👋 ¡Hola! Soy el Gestor Bot.\nPara empezar, entra en tu App > Ajustes > API Tokens, y envíame tu clave usando el comando:\n\n/link tú_sk_live_xxxxxxxxx')
      return res.status(200).send('OK')
    }

    // SI ES UN TEXTO NORMAL, ES UN GASTO
    // Recuperar el usuario atado a este chat ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('telegram_chat_id', chatId)
      .single()

    if (!profile) {
      await sendMessage(chatId, '⚠️ Tu chat no está vinculado. Usa el comando /link <TU_TOKEN> primero.')
      return res.status(200).send('OK')
    }
    const userId = profile.id

    // Lógica para extraer la cantidad (Ej: "Mercadona 45", "15.40 cervezas", "Gasto de 10 euros")
    // Esta RegEx busca el primer número positivo (opcional decimales cortos)
    const amountMatch = text.match(/(?:^|\s)(\d+(?:[.,]\d{1,2})?)(?:€|eur|euros)?(?:\s|$)/i)
    
    if (!amountMatch) {
      await sendMessage(chatId, '⚠️ No he encontrado un precio claro en tu mensaje. Usa números como 15 o 20.50')
      return res.status(200).send('OK')
    }

    const amountStr = amountMatch[1].replace(',', '.')
    const amount = Number(amountStr)

    // La descripción será el resto del texto
    let description = text.replace(amountMatch[0], ' ').trim()
    if (!description) description = 'Gasto rápido (Telegram)'

    // Buscar una cuenta y categoría por defecto para asignarle
    // (Buscamos la primera cuenta normal y la primera de gastos)
    const { data: accounts } = await supabase.from('accounts').select('id, organization_id').eq('user_id', userId).limit(1)
    const { data: categories } = await supabase.from('categories').select('id').eq('user_id', userId).eq('type', 'expense').limit(1)

    if (!accounts || accounts.length === 0) {
      await sendMessage(chatId, '⚠️ Necesitas tener al menos una Cuenta bancaria creada en la app.')
      return res.status(200).send('OK')
    }

    const { error: insertError } = await supabase
      .from('movements')
      .insert({
        user_id: userId,
        account_id: accounts[0].id,
        organization_id: accounts[0].organization_id,
        category_id: categories && categories.length > 0 ? categories[0].id : null,
        kind: 'expense',
        amount: amount,
        description: `📱 [Bot]: ${description}`,
        date: new Date().toISOString().split('T')[0] // Hoy
      })

    if (insertError) {
      console.error(insertError)
      await sendMessage(chatId, '🔥 Falló al guardar el gasto en la BBDD: ' + insertError.message)
      return res.status(200).send('OK')
    }

    await sendMessage(chatId, `🚀 Gasto guardado con éxito:\n\n➖ ${amount}€ \n📝 ${description}`)
    return res.status(200).send('OK')

  } catch (error) {
    console.error('Unhandled webhook error:', error)
  }
}
