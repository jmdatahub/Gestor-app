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

// Escapa caracteres especiales de HTML para no romper parse_mode
function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Envía mensaje a través de la API oficial de Telegram
async function sendMessage(chatId: string | number, text: string, reply_markup?: any) {
  try {
    const body: any = { chat_id: chatId, text }
    // Solo activamos HTML si el mensaje usa etiquetas nuestras (<b>, <i>)
    if (text.includes('<b>') || text.includes('<i>')) {
      body.parse_mode = 'HTML'
    }
    if (reply_markup) {
      body.reply_markup = reply_markup
    }

    const resp = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!resp.ok) {
      const err = await resp.text()
      console.error('Telegram sendMessage error:', err)
    }
  } catch (error) {
    console.error('Error sending message to Telegram:', error)
  }
}

// Responde a un callback_query para quitar el estado de "Cargando" del botón
async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  try {
    const body: any = { callback_query_id: callbackQueryId }
    if (text) body.text = text
    await fetch(`https://api.telegram.org/bot${telegramToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  } catch (err) {
    console.error('Error answering callback:', err)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST
  if (req.method !== 'POST') return res.status(200).send('OK')

  try {
    const body = req.body

    // --- PROCESAR CLICS EN BOTONES (CALLBACK QUERIES) ---
    if (body.callback_query) {
      const callbackId = body.callback_query.id
      const chatId = body.callback_query.message.chat.id
      const data = body.callback_query.data // Ej: "c:categoryPrefix:movementPrefix" o "inc:movementPrefix"
      
      // Asegurar respuesta rápida a TG para apagar el "loading" del botón
      await answerCallbackQuery(callbackId)

      // Get user linked — buscamos por texto para evitar problemas de tipo text[] vs jsonb
      const { data: linkedTokens } = await supabase
        .from('api_tokens')
        .select('user_id, organization_id')
        .filter('scopes::text', 'ilike', `%tg_chat:${chatId}%`)
        .limit(1)
      if (!linkedTokens || linkedTokens.length === 0) return res.status(200).send('OK')

      const parts = data.split(':')
      if (parts[0] === 'c' && parts.length === 3) {
        // Asignar Categoría
        const catPrefix = parts[1]
        const movPrefix = parts[2]
        
        // Buscar el id exacto
        const { data: cats } = await supabase.from('categories').select('id, name').ilike('id', `${catPrefix}%`).limit(1)
        const { data: movs } = await supabase.from('movements').select('id').ilike('id', `${movPrefix}%`).limit(1)
        
        if (cats?.length && movs?.length) {
          await supabase.from('movements').update({ category_id: cats[0].id }).eq('id', movs[0].id)
          await sendMessage(chatId, `✔️ ¡Categorizado como <b>${cats[0].name}</b>!`)
        }
      } else if (parts[0] === 'inc' && parts.length === 2) {
        // Convertir a Ingreso
        const movPrefix = parts[1]
        const { data: movs } = await supabase.from('movements').select('id').ilike('id', `${movPrefix}%`).limit(1)
        if (movs?.length) {
          await supabase.from('movements').update({ kind: 'income', category_id: null }).eq('id', movs[0].id)
          await sendMessage(chatId, `✔️ ¡Cambiado a <b>Ingreso</b>!`)
        }
      }
      return res.status(200).send('OK')
    }

    // --- PROCESAR MENSAJES DE TEXTO ---
    const message = body.message
    if (!message || !message.text) return res.status(200).send('OK')

    const chatId = message.chat.id
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

      // Guardamos el chat ID en el perfil del usuario (lookup simple y seguro)
      const chatIdStr = chatId.toString()
      await supabase
        .from('profiles')
        .update({ telegram_chat_id: chatIdStr })
        .eq('id', tokenData.user_id)

      // TAMBIÉN guardamos en scopes para poder recuperar el org_id en el lookup posterior
      const newScopes = [...(tokenData.scopes || [])]
      // Limpiamos cualquier tg_chat anterior de este token
      const cleanedScopes = newScopes.filter(s => !s.startsWith('tg_chat:'))
      cleanedScopes.push(`tg_chat:${chatIdStr}`)
      const { error: updateErr } = await supabase
        .from('api_tokens')
        .update({ scopes: cleanedScopes })
        .eq('token_hash', tokenHash)
      if (updateErr) console.error('Error updating token scopes:', updateErr)

      await sendMessage(chatId, '✅ ¡Cuenta vinculada con éxito! Ya puedes enviarme tus gastos con formato: "15.50 Cena con amigos"')
      return res.status(200).send('OK')
    }

    // Si es un comando genérico como /start
    if (text === '/start') {
      await sendMessage(chatId, '👋 ¡Hola! Soy el Gestor Bot.\nPara empezar, entra en tu App > Ajustes > API Tokens, y envíame tu clave usando el comando:\n\n/link tú_sk_live_xxxxxxxxx')
      return res.status(200).send('OK')
    }

    // SI ES UN TEXTO NORMAL, ES UN GASTO
    // PASO 1: Buscar el usuario por su telegram_chat_id en profiles (lookup simple y seguro)
    const chatIdStr = chatId.toString()
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('telegram_chat_id', chatIdStr)
      .single()

    if (!profile) {
      await sendMessage(chatId, '⚠️ Tu chat no está vinculado. Usa el comando /link <TU_TOKEN> primero.')
      return res.status(200).send('OK')
    }
    const userId = profile.id

    // PASO 2: Buscar todos los tokens del usuario y encontrar el que tiene este chat en scopes (filtrado en JS)
    const { data: userTokens } = await supabase
      .from('api_tokens')
      .select('organization_id, scopes')
      .eq('user_id', userId)

    const linkedToken = userTokens?.find(t =>
      Array.isArray(t.scopes) && t.scopes.some((s: string) => s === `tg_chat:${chatIdStr}`)
    )
    // Si no encontramos el token específico, usamos el primero disponible (fallback)
    const targetOrgId = linkedToken?.organization_id ?? null

    // Lógica para extraer la cantidad.
    // Acepta: "25 mercadona", "+25 sueldo" (ingreso), "-25 gasolina", "25,50 comida", "12.99 netflix"
    const amountMatch = text.match(/([+-]?)(\d+(?:[.,]\d{1,2})?)(?:€|eur|euros)?(?:\s|$)/i)
    
    if (!amountMatch) {
      await sendMessage(chatId, '⚠️ No he encontrado un precio claro en tu mensaje.\nEjemplos: "25 mercadona" (gasto) o "+1000 sueldo" (ingreso)')
      return res.status(200).send('OK')
    }

    const sign = amountMatch[1] // '+' o '-' o ''
    const amountStr = amountMatch[2].replace(',', '.')
    const amount = Number(amountStr)
    // Si empieza con '+' es un ingreso, en cualquier otro caso es un gasto
    const kind: 'income' | 'expense' = sign === '+' ? 'income' : 'expense'

    // La descripción será el resto del texto (quitamos el número y el signo)
    let description = text.replace(amountMatch[0], ' ').replace(/^[+-]/, '').trim()
    if (!description) description = kind === 'income' ? 'Ingreso rápido (Telegram)' : 'Gasto rápido (Telegram)'

    // Buscar una cuenta que pertenezca ESPECÍFICAMENTE al workspace elegido (targetOrgId)
    let accountQuery = supabase.from('accounts').select('id, organization_id').eq('user_id', userId)
    if (targetOrgId === null) {
      accountQuery = accountQuery.is('organization_id', null)
    } else {
      accountQuery = accountQuery.eq('organization_id', targetOrgId)
    }
    const { data: accountsData } = await accountQuery.limit(1)

    // Buscar categoría por defecto
    let categoryQuery = supabase.from('categories').select('id').eq('user_id', userId).eq('type', 'expense')
    if (targetOrgId === null) {
      categoryQuery = categoryQuery.is('organization_id', null)
    } else {
      categoryQuery = categoryQuery.eq('organization_id', targetOrgId)
    }
    const { data: categories } = await categoryQuery.limit(1)

    if (!accountsData || accountsData.length === 0) {
      const wName = targetOrgId ? 'ese Entorno de trabajo' : 'tu Entorno Personal'
      await sendMessage(chatId, `⚠️ Necesitas tener al menos una Cuenta bancaria creada en ${wName}.`)
      return res.status(200).send('OK')
    }

    const { data: createdMovement, error: insertError } = await supabase
      .from('movements')
      .insert({
        user_id: userId,
        account_id: accountsData[0].id,
        organization_id: targetOrgId,
        category_id: categories && categories.length > 0 ? categories[0].id : null,
        kind: kind,
        amount: amount,
        description: `📱 [Bot]: ${description}`,
        date: new Date().toISOString().split('T')[0] // Hoy
      })
      .select('id')
      .single()

    if (insertError || !createdMovement) {
      console.error(insertError)
      await sendMessage(chatId, '🔥 Falló al guardar el gasto en la BBDD: ' + insertError?.message)
      return res.status(200).send('OK')
    }

    const movPrefix = createdMovement.id.substring(0, 8)

    // Buscar las top categorías del usuario (del tipo que corresponde)
    let catQuery = supabase.from('categories').select('id, name').eq('user_id', userId).eq('type', kind)
    if (targetOrgId === null) {
      catQuery = catQuery.is('organization_id', null)
    } else {
      catQuery = catQuery.eq('organization_id', targetOrgId)
    }
    const { data: topCategories } = await catQuery.limit(8)

    // Armar el teclado interactivo
    const keyboard: any[][] = []
    let row: any[] = []
    
    topCategories?.forEach((cat) => {
      row.push({ text: `📁 ${cat.name}`, callback_data: `c:${cat.id.substring(0,8)}:${movPrefix}` })
      if (row.length === 2) { // 2 botones por fila
        keyboard.push(row)
        row = []
      }
    })
    if (row.length > 0) keyboard.push(row)
    
    // Botón para cambiar el tipo — solo mostramos si hay categorías
    if (kind === 'expense') {
      keyboard.push([{ text: '➕ Cambiar a Ingreso', callback_data: `inc:${movPrefix}` }])
    } else {
      keyboard.push([{ text: '➖ Cambiar a Gasto', callback_data: `exp:${movPrefix}` }])
    }

    // Escapamos la descripción del usuario para evitar que rompa el HTML
    const safeDesc = escapeHtml(description)
    const typeLabel = kind === 'income' ? 'Ingreso' : 'Gasto'
    const typeSign = kind === 'income' ? '➕' : '➖'
    const msgTxt = keyboard.length > 1
      ? `🚀 <b>${typeLabel} guardado:</b>\n${typeSign} <b>${amount}€</b>\n📝 ${safeDesc}\n\n<i>¿En qué categoría lo clasifico?</i>`
      : `🚀 ${typeLabel} guardado:\n${typeSign} ${amount}€\n📝 ${safeDesc}`
    await sendMessage(chatId, msgTxt, keyboard.length > 1 ? { inline_keyboard: keyboard } : undefined)

    return res.status(200).send('OK')

  } catch (error) {
    console.error('Unhandled webhook error:', error)
    return res.status(200).send('OK')
  }
}
