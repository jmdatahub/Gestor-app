# Gestor-app — Instrucciones para Claude

## Autonomía
- Ejecuta todo sin pedir confirmación: commits, PRs, merges, cambios en BD, deploys, etc.
- No preguntes "¿quieres que lo haga?" si ya sabes cómo hacerlo.
- Cuando encuentres bugs o mejoras adicionales durante una tarea, arréglales directamente sin mencionar que lo haces.

## Bot de Telegram — webhook lifecycle (incidente 22-may-2026)

El bot `GestorJorgePersonalBot` (token en `.env`, secret en `.env`) usa webhook
contra `https://finanzas.soulia.info/api/v1/telegram-webhook`. El webhook se
borra silenciosamente en algunos escenarios (deleteWebhook explícito, migración
de hosting, BotFather token rotado, etc.) y Telegram NO avisa — los updates se
acumulan en una cola invisible mientras el usuario cree que el bot le ignora.

**Garantías ya implementadas (NO deshacerlas):**

1. **`server/lib/telegram-webhook-state.ts`** — `ensureWebhookRegistered()` se
   llama al boot del server (`server/index.ts`, dentro de `bindServer`). Solo
   en `NODE_ENV=production`. Compara la URL real (vía `getWebhookInfo`) con
   `${PUBLIC_URL}/api/v1/telegram-webhook`; si no coinciden, hace `setWebhook`.
2. **`server/lib/integrations.ts`** — Manifest que imprime banner al boot
   listando integraciones (`db_finanzas`, `telegram_bot`, `resend`) y `disabled`
   con env var faltante. Usado también por `/api/health`.
3. **`/api/health` reporta `bot.status`** — `'ok'|'misaligned'|'empty'|...`,
   con cache 60 s. Si !== `ok`/`disabled`, el endpoint devuelve **503**.
4. **Watchdog en el CRM** (`CRM-app/server/services/gestorBotWatchdog.service.ts`)
   — cron cada 10 min que pingea `/api/health` del Gestor y avisa al admin por
   Telegram + email si detecta problema. Vive en el CRM porque debe ser
   independiente del Gestor (si el Gestor cae, el CRM avisa).

**Reglas duras al tocar el bot/webhook:**

- **NUNCA llames `deleteWebhook` sin un plan documentado de re-registro.**
- Si tienes que cambiar `PUBLIC_URL` o el host, actualiza `setWebhook` en el
  MISMO deploy (no en dos pasos).
- Si añades env vars nuevas que gatean Telegram, mételas en el manifest
  `server/lib/integrations.ts` para que aparezcan en el boot banner y en
  `/api/health`.
- Verifica con `getWebhookInfo` después de cualquier redeploy que toque
  `PUBLIC_URL` o `TELEGRAM_WEBHOOK_SECRET`.

## Agentes en paralelo — OBLIGATORIO
Cuando la tarea implique auditoría, análisis, corrección o mejora de múltiples áreas del código (más de 2 archivos o sistemas distintos), DEBES desplegar múltiples agentes especializados en paralelo en lugar de trabajar secuencialmente. Reglas:

- **Mínimo 4 agentes en paralelo** para cualquier auditoría o refactor amplio.
- **Divide siempre por dominio**: un agente por área (ej: rutas servidor, páginas cliente, servicios, DB, bot, etc.).
- **Nunca hagas en secuencia lo que puedes hacer en paralelo.** Si dos tareas no dependen entre sí, van en paralelo.
- **Para investigación + corrección**: lanza primero agentes de investigación en paralelo, luego agentes de corrección en paralelo con los hallazgos.
- Usa `isolation: "worktree"` en todos los agentes que modifiquen archivos para evitar conflictos.
- Si el usuario pide "arregla todo" o "analiza todo", interpreta eso como: despliega el máximo número de agentes especializados posible en paralelo cubriendo todas las áreas del proyecto.
