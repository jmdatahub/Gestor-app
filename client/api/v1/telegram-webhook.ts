import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { applySecurityHeaders } from './_security'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const telegramToken = process.env.TELEGRAM_BOT_TOKEN || ''
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || ''

if (!telegramToken) {
  console.error('[telegram-webhook] Missing TELEGRAM_BOT_TOKEN env var - bot operations will fail.')
}
if (!webhookSecret) {
  console.error('[telegram-webhook] Missing TELEGRAM_WEBHOOK_SECRET env var - webhook will reject all requests.')
}

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

// Edita el teclado interactivo/texto de un mensaje existente
async function editMessageText(chatId: string | number, messageId: number, text: string, reply_markup?: any) {
  try {
    const body: any = {
      chat_id: chatId,
      message_id: messageId,
      text: text
    }
    if (text.includes('<b>') || text.includes('<i>')) {
      body.parse_mode = 'HTML'
    }
    if (reply_markup) {
      body.reply_markup = reply_markup
    }
    const resp = await fetch(`https://api.telegram.org/bot${telegramToken}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!resp.ok) {
      const err = await resp.text()
      console.error('Telegram editMessageText error:', err)
    }
  } catch (error) {
    console.error('Error editing message:', error)
  }
}

// Crea el teclado paginado de categorías
async function buildCategoriesKeyboard(userId: string, targetOrgId: string | null, kind: 'expense' | 'income', movPrefix: string, page: number = 0) {
  const PAGE_SIZE = 6

  // Fetcheamos categorías del usuario (Personales + Organización actual)
  const catQuery = supabase.from('categories').select('id, name, organization_id').eq('user_id', userId).eq('kind', kind)
  const { data: allCats } = await catQuery.order('name', { ascending: true })

  // Filtramos y eliminamos duplicados visuales (si tiene "Comida" en personal y org, solo una)
  const cats: any[] = []
  const seenNames = new Set()
  
  if (allCats) {
    allCats.forEach(c => {
      if (!seenNames.has(c.name.toLowerCase())) {
        cats.push(c)
        seenNames.add(c.name.toLowerCase())
      }
    })
  }

  const total = cats.length
  const offset = page * PAGE_SIZE
  const pageCats = cats.slice(offset, offset + PAGE_SIZE)
  const hasNext = offset + PAGE_SIZE < total
  const hasPrev = page > 0
  const kindShort = kind === 'expense' ? 'e' : 'i'
  const keyboard: any[][] = []
  let row: any[] = []

  // Botones de categorías
  pageCats.forEach((cat) => {
    row.push({ text: `📌 ${cat.name}`, callback_data: `c:${cat.id.substring(0,8)}:${movPrefix}` })
    if (row.length === 2) { keyboard.push(row); row = [] }
  })
  if (row.length > 0) keyboard.push(row)

  if (hasPrev || hasNext) {
    const navRow: any[] = []
    if (hasPrev) navRow.push({ text: `⬅️`, callback_data: `p:${page - 1}:${kindShort}:${movPrefix}` })
    navRow.push({ text: `📄 ${page + 1}/${Math.ceil(total / PAGE_SIZE)}`, callback_data: `noop` })
    if (hasNext) navRow.push({ text: `➡️`, callback_data: `p:${page + 1}:${kindShort}:${movPrefix}` })
    keyboard.push(navRow)
  }

  const switchLabel = kind === 'expense' ? '💰 Ingreso' : '💸 Gasto'
  const switchCb = kind === 'expense' ? `inc:${movPrefix}` : `exp:${movPrefix}`
  keyboard.push([{ text: switchLabel, callback_data: switchCb }])

  return keyboard
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applySecurityHeaders(res)

  // Only accept POST
  if (req.method !== 'POST') return res.status(200).send('OK')

  // Verify Telegram webhook secret (set when calling setWebhook with secret_token).
  // Without this, any caller could send forged updates to the unauthenticated endpoint.
  // An empty/unset webhookSecret disables the webhook entirely (fail-closed).
  if (!webhookSecret) {
    return res.status(503).json({ error: 'Webhook not configured' })
  }
  const incomingSecret = req.headers['x-telegram-bot-api-secret-token']
  const incomingValue = Array.isArray(incomingSecret) ? incomingSecret[0] : incomingSecret
  // Constant-time comparison to prevent timing attacks
  if (
    !incomingValue ||
    incomingValue.length !== webhookSecret.length ||
    !crypto.timingSafeEqual(Buffer.from(incomingValue), Buffer.from(webhookSecret))
  ) {
    console.warn('[telegram-webhook] Rejected request with invalid/missing secret token')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const body = req.body

    // --- PROCESAR CLICS EN BOTONES (CALLBACK QUERIES) ---
    if (body.callback_query) {
      const callbackId = body.callback_query.id
      const chatId = body.callback_query.message.chat.id
      const data = body.callback_query.data // Ej: "c:categoryPrefix:movementPrefix" o "inc:movementPrefix"
      
      // Asegurar respuesta rápida a TG para apagar el "loading" del botón
      await answerCallbackQuery(callbackId)

      // Admin: approve/reject new user registration
      if (data.startsWith('app:') || data.startsWith('rej:')) {
        const colonIdx = data.indexOf(':')
        const action = data.substring(0, colonIdx)
        const targetUserId = data.substring(colonIdx + 1)
        const chatIdStr = chatId.toString()
        const { data: adminProf } = await supabase.from('profiles').select('is_super_admin').eq('telegram_chat_id', chatIdStr).single()
        if (!adminProf?.is_super_admin) {
          await sendMessage(chatId, '⛔ No tienes permisos para esta acción.')
          return res.status(200).send('OK')
        }
        const { data: targetProf } = await supabase.from('profiles').select('email, telegram_chat_id').eq('id', targetUserId).single()
        const targetEmail = targetProf?.email || targetUserId

        if (action === 'app') {
          await supabase.from('profiles').update({ is_approved: true }).eq('id', targetUserId)
          await editMessageText(chatId, body.callback_query.message.message_id, `✅ <b>Usuario aprobado</b>\n\n👤 ${targetEmail}\nYa puede iniciar sesión.`)
          if (targetProf?.telegram_chat_id) {
            await sendMessage(targetProf.telegram_chat_id, '✅ <b>¡Tu cuenta ha sido aprobada!</b>\n\nYa puedes iniciar sesión en la app.')
          }
        } else {
          await supabase.auth.admin.deleteUser(targetUserId)
          await editMessageText(chatId, body.callback_query.message.message_id, `❌ <b>Solicitud rechazada</b>\n\n👤 ${targetEmail}\nLa cuenta ha sido eliminada.`)
        }
        return res.status(200).send('OK')
      }

      const chatIdStr = chatId.toString()
      const { data: profile } = await supabase.from('profiles').select('id').eq('telegram_chat_id', chatIdStr).single()
      if (!profile) return res.status(200).send('OK')
      const userId = profile.id
      
      const { data: userTokens } = await supabase.from('api_tokens').select('organization_id, scopes').eq('user_id', userId)
      const linkedToken = userTokens?.find(t => Array.isArray(t.scopes) && t.scopes.some((s: string) => s === `tg_chat:${chatIdStr}`))
      const targetOrgId = linkedToken?.organization_id ?? null

      const parts = data.split(':')
      if (parts[0] === 'c' && parts.length === 3) {
        // Asignar Categoría
        const catPrefix = parts[1]
        const movPrefix = parts[2]
        // Buscar el id exacto
        // Buscar el id exacto en JS buscando en TODOS los niveles
        const { data: userCats } = await supabase.from('categories').select('id, name').eq('user_id', userId)
        const { data: userMovs } = await supabase.from('movements').select('id, amount, kind, description').eq('user_id', userId).order('created_at', { ascending: false }).limit(30)
        
        const cat = userCats?.find(c => c.id.startsWith(catPrefix))
        const mov = userMovs?.find(m => m.id.startsWith(movPrefix))
        
        if (cat && mov) {
          await supabase.from('movements').update({ category_id: cat.id }).eq('id', mov.id)
          const safeDesc = escapeHtml(mov.description || '')
          const typeLabel = mov.kind === 'income' ? 'Ingreso' : 'Gasto'
          const msgTxt = `📌 <b>${cat.name}</b>\n✅ Categorizado correctamente.\n\n<i>💬 ¿Quieres añadir una nota? Escríbela ahora.</i>`
          await editMessageText(chatId, body.callback_query.message.message_id, msgTxt)
        }
      } else if ((parts[0] === 'inc' || parts[0] === 'exp') && parts.length === 2) {
        // Convertir a Ingreso/Gasto
        const newKind = parts[0] === 'inc' ? 'income' : 'expense'
        const movPrefix = parts[1]
        
        const { data: userMovs } = await supabase.from('movements').select('id, amount, description').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
        const mov = userMovs?.find(m => m.id.startsWith(movPrefix))
        
        if (mov) {
          await supabase.from('movements').update({ kind: newKind, category_id: null }).eq('id', mov.id)
          
          // Regen keyboard
          const kb = await buildCategoriesKeyboard(userId, targetOrgId, newKind, movPrefix, 0)
          const safeDesc = escapeHtml(mov.description || '')
          const typeLabel = newKind === 'income' ? 'Ingreso' : 'Gasto'
          const typeSign = newKind === 'income' ? '➕' : '➖'
          const msgTxt = kb.length > 0
            ? `🚀 <b>${typeLabel} convertido:</b>\n${typeSign} <b>${mov.amount}€</b>\n📝 ${safeDesc}\n\n<i>¿En qué categoría lo clasifico?</i>`
            : `🚀 ${typeLabel} convertido:\n${typeSign} ${mov.amount}€\n📝 ${safeDesc}`
            
          await editMessageText(chatId, body.callback_query.message.message_id, msgTxt, kb.length > 0 ? { inline_keyboard: kb } : undefined)
        }
      } else if (parts[0] === 'p' && parts.length === 4) {
        // Paginación: p:<page>:<e|i>:<movPrefix>
        const page = parseInt(parts[1], 10)
        const kind = parts[2] === 'e' ? 'expense' : 'income'
        const movPrefix = parts[3]
        
        const kb = await buildCategoriesKeyboard(userId, targetOrgId, kind, movPrefix, page)
        
        // Buscamos el movimiento para reconstruir el texto del mensaje con HTML
        const { data: userMovs } = await supabase.from('movements').select('id, amount, kind, description').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
        const mov = userMovs?.find(m => m.id.startsWith(movPrefix))
        
        if (mov) {
          const safeDesc = escapeHtml(mov.description || '')
          const typeLabel = kind === 'expense' ? 'Gasto' : 'Ingreso'
          const typeSign = kind === 'expense' ? '➖' : '➕'
          const msgTxt = `🚀 <b>${typeLabel} guardado:</b>\n${typeSign} <b>${mov.amount}€</b>\n📝 ${safeDesc}\n\n<i>¿En qué categoría lo clasifico? 👇</i>`
          await editMessageText(chatId, body.callback_query.message.message_id, msgTxt, { inline_keyboard: kb })
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
      const tokenHash = await hashToken(rawToken)
      const { data: tokenData, error: tokenError } = await supabase.from('api_tokens').select('user_id, organization_id, scopes').eq('token_hash', tokenHash).single()

      if (tokenError || !tokenData) {
        await sendMessage(chatId, '❌ Token no encontrado.')
        return res.status(200).send('OK')
      }

      const chatIdStr = chatId.toString()
      await supabase.from('profiles').update({ telegram_chat_id: chatIdStr }).eq('id', tokenData.user_id)
      
      const newScopes = [...(tokenData.scopes || [])].filter(s => !s.startsWith('tg_chat:'))
      newScopes.push(`tg_chat:${chatIdStr}`)
      await supabase.from('api_tokens').update({ scopes: newScopes }).eq('token_hash', tokenHash)

      await sendMessage(
        chatId,
        `✅ <b>¡Cuenta vinculada!</b>\n\nA partir de ahora recibirás notificaciones aquí cuando se genere una alerta en Gestor.\n\n<i>Usa /notifications para gestionar tus preferencias.</i>`
      )
      return res.status(200).send('OK')
    }

    // Si es un comando genérico como /start
    if (text === '/start') {
      await sendMessage(
        chatId,
        `👋 <b>¡Hola! Soy el Gestor Bot.</b>\n\nPuedo ayudarte a:\n• Registrar gastos e ingresos escribiendo el importe\n• Recibir alertas automáticas de tu cuenta\n\n<b>Comandos disponibles:</b>\n/link &lt;token&gt; — Vincular tu cuenta\n/notifications — Gestionar notificaciones\n/help — Ver esta ayuda\n\n<i>Para empezar, usa: /link tu_token</i>`
      )
      return res.status(200).send('OK')
    }

    // Alias de /start
    if (text === '/help') {
      await sendMessage(
        chatId,
        `📖 <b>Comandos del Gestor Bot</b>\n\n/link &lt;token&gt; — Vincular tu cuenta de Gestor\n/notifications — Activar o desactivar alertas\n/help — Ver esta ayuda\n\n<b>Registro rápido:</b>\nEscribe directamente el importe y la descripción:\n<code>25 mercadona</code> → gasto\n<code>+1000 nómina</code> → ingreso`
      )
      return res.status(200).send('OK')
    }

    // Gestión de notificaciones: /notifications [on|off]
    // Preference stored as scope 'tg_notif:off' in api_tokens — no schema migration required
    if (text.startsWith('/notifications')) {
      const chatIdStr = chatId.toString()
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('telegram_chat_id', chatIdStr)
        .single()

      if (!profile) {
        await sendMessage(chatId, '⚠️ Primero vincula tu cuenta con /link')
        return res.status(200).send('OK')
      }

      const { data: userTokens } = await supabase
        .from('api_tokens')
        .select('token_hash, scopes')
        .eq('user_id', profile.id)

      const linkedToken = (userTokens ?? []).find(
        (t: { scopes: string[] }) => Array.isArray(t.scopes) && t.scopes.includes(`tg_chat:${chatIdStr}`)
      )

      if (!linkedToken) {
        await sendMessage(chatId, '⚠️ No se encontró el token vinculado. Vuelve a usar /link.')
        return res.status(200).send('OK')
      }

      const arg = text.split(/\s+/)[1]?.toLowerCase()
      const currentScopes: string[] = linkedToken.scopes ?? []
      const isDisabled = currentScopes.includes('tg_notif:off')

      if (arg === 'on') {
        await supabase
          .from('api_tokens')
          .update({ scopes: currentScopes.filter((s: string) => s !== 'tg_notif:off') })
          .eq('token_hash', linkedToken.token_hash)
        await sendMessage(chatId, '🔔 <b>Notificaciones activadas.</b>\nRecibirás alertas de Gestor aquí.')
      } else if (arg === 'off') {
        await supabase
          .from('api_tokens')
          .update({ scopes: [...currentScopes.filter((s: string) => s !== 'tg_notif:off'), 'tg_notif:off'] })
          .eq('token_hash', linkedToken.token_hash)
        await sendMessage(chatId, '🔕 <b>Notificaciones desactivadas.</b>\nNo recibirás más alertas aquí.\n\n<i>Puedes reactivarlas con /notifications on</i>')
      } else {
        const status = isDisabled ? '🔕 <b>Desactivadas</b>' : '🔔 <b>Activadas</b>'
        await sendMessage(chatId, `${status}\n\nUsa:\n/notifications on — activar\n/notifications off — desactivar`)
      }
      return res.status(200).send('OK')
    }

    // COMANDO OCULTO: /magia para auto-crear categorías pedidas por el usuario
    if (text === '/magia') {
      const chatIdStr = chatId.toString()
      const { data: profile } = await supabase.from('profiles').select('id').eq('telegram_chat_id', chatIdStr).single()
      if (!profile) {
        await sendMessage(chatId, '⚠️ Vincula tu cuenta primero con /link')
        return res.status(200).send('OK')
      }
      
      const userId = profile.id
      
      // Obtenemos su org activa para limpiar y crear ahí también
      const { data: userTokens } = await supabase.from('api_tokens').select('organization_id, scopes').eq('user_id', userId)
      const linkedToken = userTokens?.find(t => Array.isArray(t.scopes) && t.scopes.some((s: string) => s === `tg_chat:${chatIdStr}`))
      const targetOrgId = linkedToken?.organization_id ?? null

      // LIMPIEZA DRÁSTICA: Borrar por USER_ID (limpia personal y orgs donde es dueño)
      await supabase.from('categories').delete().eq('user_id', userId)
      
      // Inyección de lista limpia
      const list = [
        { name: 'Ocio', kind: 'expense', color: '#f43f5e' },
        { name: 'Transporte', kind: 'expense', color: '#eab308' },
        { name: 'Comida', kind: 'expense', color: '#22c55e' },
        { name: 'Otros', kind: 'expense', color: '#64748b' },
        { name: 'Regalo', kind: 'income', color: '#ec4899' },
        { name: 'Salario', kind: 'income', color: '#14b8a6' },
        { name: 'Soul IA', kind: 'income', color: '#8b5cf6' },
        { name: 'Just Jorge', kind: 'income', color: '#3b82f6' },
        { name: 'Otros', kind: 'income', color: '#94a3b8' }
      ]

      const newCats = list.map(c => ({
        ...c,
        user_id: userId,
        organization_id: targetOrgId // Se crean en el mismo sitio donde se crean sus gastos
      }))
      
      const { error } = await supabase.from('categories').insert(newCats)
      if (error) {
        console.error('[telegram-webhook] /magia insert error:', error)
        await sendMessage(chatId, '❌ Error al reiniciar las categorías. Inténtalo de nuevo.')
      } else {
        const orgInfo = targetOrgId ? 'Org: Soul IA' : 'Entorno Personal'
        await sendMessage(chatId, `✨ <b>¡SISTEMA RESETEADO!</b>\n\nEntorno: <code>${orgInfo}</code>\n\nHe configurado exactamente lo que pediste. No verás duplicados nunca más.`)
      }
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
      // SI NO TIENE PRECIO -> Asumimos que es una Nota para el último gasto
      // Buscamos el último movimiento creado en los últimos 15 min
      const { data: recentMov } = await supabase
        .from('movements')
        .select('id, amount, kind, description')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (recentMov && recentMov.length > 0) {
        // Si la descripción es solo el emoji placeholder, la reemplazamos entera por la nota nueva.
        const currentDesc = recentMov[0].description || ''
        const isPlaceholder = currentDesc === '📱' || currentDesc.includes('Gasto rápido')
        const newDesc = isPlaceholder ? text : `${currentDesc} - ${text}`
        
        await supabase.from('movements').update({ description: newDesc }).eq('id', recentMov[0].id)
        await sendMessage(chatId, `📝 ¡Nota guardada!`)
      } else {
        await sendMessage(chatId, '⚠️ No he encontrado un precio claro en tu mensaje.\nEjemplos: "25 mercadona" (gasto) o "+1000 sueldo" (ingreso)')
      }
      return res.status(200).send('OK')
    }

    const sign = amountMatch[1] // '+' o '-' o ''
    const amountStr = amountMatch[2].replace(',', '.')
    const amount = Number(amountStr)

    // Reject unreasonable amounts
    if (amount <= 0 || amount > 10_000_000) {
      await sendMessage(chatId, '⚠️ El importe no es válido. Debe estar entre 0.01 y 10,000,000.')
      return res.status(200).send('OK')
    }

    // Si empieza con '+' es un ingreso, en cualquier otro caso es un gasto
    const kind: 'income' | 'expense' = sign === '+' ? 'income' : 'expense'

    // La descripción será el resto del texto (quitamos el número y el signo)
    let description = text.replace(amountMatch[0], ' ').replace(/^[+-]/, '').trim().slice(0, 500)
    if (!description) description = '📱'

    // Buscar una cuenta que pertenezca ESPECÍFICAMENTE al workspace elegido (targetOrgId)
    let accountQuery = supabase.from('accounts').select('id, organization_id').eq('user_id', userId)
    if (targetOrgId === null) {
      accountQuery = accountQuery.is('organization_id', null)
    } else {
      accountQuery = accountQuery.eq('organization_id', targetOrgId)
    }
    const { data: accountsData } = await accountQuery.limit(1)

    const categoryQuery = supabase.from('categories').select('id').eq('user_id', userId).eq('kind', kind)
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
        description: description,
        date: new Date().toISOString().split('T')[0] // Hoy
      })
      .select('id')
      .single()

    if (insertError || !createdMovement) {
      console.error('[telegram-webhook] Insert error:', insertError)
      await sendMessage(chatId, '🔥 No se pudo guardar el movimiento. Inténtalo de nuevo.')
      return res.status(200).send('OK')
    }

    const movPrefix = createdMovement.id.substring(0, 8)

    // Armar el teclado interactivo usando la nueva función con paginación (página 0 inicial)
    const keyboard = await buildCategoriesKeyboard(userId, targetOrgId, kind, movPrefix, 0)

    // Escapamos la descripción del usuario para evitar que rompa el HTML
    const safeDesc = escapeHtml(description)
    const typeLabel = kind === 'income' ? 'Ingreso' : 'Gasto'
    const typeSign = kind === 'income' ? '➕' : '➖'
    const msgTxt = keyboard.length > 0
      ? `🚀 <b>${typeLabel} guardado:</b>\n${typeSign} <b>${amount}€</b>\n📝 ${safeDesc}\n\n<i>¿En qué categoría lo clasifico? 👇</i>\n<i>(También puedes escribir texto normal enviarlo para añadir o cambiar la nota)</i>`
      : `🚀 ${typeLabel} guardado:\n${typeSign} ${amount}€\n📝 ${safeDesc}`
    await sendMessage(chatId, msgTxt, keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined)

    return res.status(200).send('OK')

  } catch (error) {
    console.error('Unhandled webhook error:', error)
    return res.status(200).send('OK')
  }
}
