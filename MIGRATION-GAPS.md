# Migración Vercel → VPS — Inventario de gaps

> Auditoría inicial: 2026-04-30. Última actualización: **2026-05-26** (cutover del bot Telegram completado, decisión de mantener Vercel apagado pero no borrado hasta ~9-jun-2026 como red de seguridad).
>
> Estado real a 26-may-2026: el bot Telegram apunta al VPS (`finanzas.soulia.info`) y el CRM lee Finanzas vía Postgres directo. Vercel sigue vivo pero no recibe tráfico productivo.

## 🟢 Ya migrado y funcionando

| Pieza | Origen | Destino |
|---|---|---|
| Frontend SPA | `gestor-app-ashy.vercel.app` | Express estático en `https://finanzas.soulia.info` |
| Auth (login/register/logout) | Supabase Auth | JWT propio `server/middleware/auth.ts` + `server/routes/auth.routes.ts` |
| Reset password / change password | Supabase Auth | `server/routes/auth.routes.ts` + Resend (`server/services/email.service.ts`) |
| BD de datos | Supabase Cloud `pruiccptamjzemedwhdq` | Postgres VPS (`finanzas`) |
| CRUD de movements / accounts / categories / budgets / alerts / debts / savings / investments / recurring / pending / organizations / profiles / payment-methods / providers / api-tokens | `client/src/services/*.ts` con `supabase.from(...)` | `server/routes/*.ts` con Drizzle, todos en `/api/v1/*` |
| Admin panel (`/api/v1/admin/me` + organizations CRUD) | Sin endpoint dedicado | `server/routes/admin.routes.ts` — añadido hoy |
| Email transaccional | (no había) | Resend con dominio `soulia.info` |

## 🔴 Pendiente de portar — bloquea borrar Vercel

### 1. CRM-sync (CRÍTICO — el CRM lo está usando ahora mismo)

| Endpoint Vercel | Origen | Quién lo usa |
|---|---|---|
| `app-clean-five.vercel.app/api/crm-sync/summary` | `client/api/_handlers/crm-sync/summary.ts` | CRM `finance.routes.ts` → `proxyToFinance('/summary')` |
| `…/crm-sync/overview` | `…/overview.ts` | CRM admin panel + `user-activity` |
| `…/crm-sync/movements` | `…/movements.ts` | CRM (GET list, POST create, PATCH, DELETE) |
| `…/crm-sync/accounts` | `…/accounts.ts` | CRM (CRUD) |
| `…/crm-sync/categories` | `…/categories.ts` | CRM (CRUD) |
| `…/crm-sync/recurring` | `…/recurring.ts` | CRM (CRUD + onCreate hook) |
| `…/crm-sync/debts` | `…/debts.ts` | CRM (CRUD + onCreate hook) |
| `…/crm-sync/savings` | `…/savings.ts` | CRM (CRUD + onCreate hook) |
| `…/crm-sync/investments` | `…/investments.ts` | CRM (CRUD) |

**Auth**: header `x-api-key: <CRM_SYNC_SECRET>`. Implícito en todos los handlers.

**Plan de port**: crear `server/routes/crm-sync.routes.ts` que:
- Valida `x-api-key` contra `process.env.CRM_SYNC_SECRET` (env var nueva).
- Resuelve org "Soul IA" por nombre (cacheado 5 min) — mismo patrón Vercel.
- Migra cada handler de Supabase client → Drizzle + Postgres VPS.
- Soporta soft-delete (`?trash=1`, `?restore=1`, `?hard=1`) y audit (`x-actor-email` → `created_by_email`/`updated_by_email`).
- Montar en `app.use('/api/crm-sync', crmSyncRoutes)` (sin `/v1` para mantener URL legacy).

**Cuando esté**: cambiar `FINANCE_API_URL` del CRM (Dokploy) a `https://finanzas.soulia.info/api/crm-sync` y `FINANCE_API_KEY` al mismo `CRM_SYNC_SECRET`.

### 2. Webhook de Telegram ✅ PORTADO + ✅ CUTOVER COMPLETADO (26-may-2026)

| Endpoint | Destino |
|---|---|
| `POST /api/v1/telegram-webhook` | `server/routes/telegram.routes.ts` |

**✅ Webhook re-registrado el 26-may-2026** apuntando a `https://finanzas.soulia.info/api/v1/telegram-webhook` con `TELEGRAM_WEBHOOK_SECRET` correcto. Variables `TELEGRAM_BOT_TOKEN` y `TELEGRAM_WEBHOOK_SECRET` ya en Dokploy.

**Hardening añadido tras incidente del 22-may (bot caído 5 días sin alerta)**:
- `server/lib/telegram-webhook-state.ts` — `ensureWebhookRegistered()` se llama en boot del Express; si el webhook está vacío o desalineado lo re-registra automáticamente.
- `/api/health` reporta `bot.status` con cache 60 s; HTTP 503 si !== `ok`/`disabled`.
- `server/lib/integrations.ts` — manifest declarativo + boot banner + `requireIntegration()` helper.
- Watchdog independiente en CRM-app (`server/services/gestorBotWatchdog.service.ts`) cada 10 min via `sendOpsAlert`.

### 3. Notificaciones internas ✅ PORTADO

| Endpoint | Destino |
|---|---|
| `POST /api/v1/notify` | `server/routes/notify.routes.ts` |
| notify-new-user | Integrado en `POST /api/auth/register` (Telegram + email al admin) |
| reject-user | `DELETE /api/v1/admin/users/:id` en `server/routes/admin.routes.ts` |
| approve-user | `PATCH /api/v1/admin/users/:id/approve` en `server/routes/admin.routes.ts` |

**Registro de usuarios**: `POST /api/auth/register` crea el usuario con `isActive=false`, notifica al admin vía Telegram (botones Aprobar/Rechazar) y email (`ADMIN_EMAIL`).

### 4. API pública v1 para integraciones externas (opcional)

| Endpoint Vercel | Uso |
|---|---|
| `…/api/v1/movements` (GET, POST con API token) | Documentado en `client/src/components/SettingsPanel.tsx` y `ApiDocsPanel.tsx`. Permite a usuarios crear movements desde scripts externos con su API token personal. |
| `…/api/v1/index` | Health + metadata pública |

**Plan**: ya hay `server/routes/api-tokens.routes.ts`. Añadir un middleware que valide `Authorization: Bearer <api-token-personal>` (no JWT) y exponer `app.use('/api/v1/movements-public', ...)` o reusar `/api/v1/movements` con auth dual (JWT o API token).

## 🟡 Otras integraciones a verificar

- **Sentry**: el cliente importa `@sentry/react`. Variable `VITE_SENTRY_DSN` debe estar en GitHub vars (build args). **Verificar en Dokploy / GitHub**.
- **PWA + Service Worker**: ya viene del cliente; no depende de Vercel.
- **Cron jobs / scheduled tasks**: el repo tiene `recurring-rules` (movimientos recurrentes pendientes de generar). En Vercel se ejecutaba con cron + `vercel.json`. **Verificar si hay un cron en Dokploy** o si se ejecuta on-demand al cargar la página.

## 📋 Plan de ejecución recomendado

1. ✅ **Portado**: CRM-sync → `server/routes/crm-sync.routes.ts`
2. ✅ **Portado**: Telegram webhook → `server/routes/telegram.routes.ts`
3. ✅ **Portado**: notify (alertas) → `server/routes/notify.routes.ts`
4. ✅ **Portado**: notify-new-user + register → `POST /api/auth/register`
5. ✅ **Portado**: reject/approve user → `server/routes/admin.routes.ts`
6. ✅ **HECHO 26-may-2026**: webhook Telegram apuntado a `https://finanzas.soulia.info/api/v1/telegram-webhook` + hardening (auto-restore en boot + watchdog en CRM).
7. **Pendiente**: integrar API pública con tokens.
8. **Pendiente**: validar Sentry y crons.
9. ✅ **HECHO**: el CRM ya lee Finanzas via Postgres directo (`FINANZAS_DB_URL`). Las env vars `FINANCE_API_URL` / `FINANCE_API_KEY` siguen en Dokploy del CRM pero son huérfanas legacy (limpieza programada para 9-jun).
10. **Programado para 9-jun-2026** (2 semanas estables): borrar proyectos Vercel + limpiar env vars huérfanas + código `client/api/` huérfano.

## ❌ NO borrar Vercel todavía (hasta ~9-jun-2026)

Aunque `app-clean-five.vercel.app` ya no recibe tráfico productivo (el CRM lee Finanzas via Postgres directo desde la migración del 27-abr y el bot Telegram apunta al VPS desde el 26-may), se mantienen vivos los proyectos Vercel `app-clean` y `gestor-app-ashy` como red de seguridad para rollback rápido durante las 2 semanas siguientes al cutover. A partir del 9-jun-2026, si la migración VPS sigue estable, ejecutar el punto 10 del plan (borrar proyectos + limpiar env vars huérfanas del CRM).

Nota técnica: el handler webhook serverless de Vercel está actualmente **roto** (HTTP 500 FUNCTION_INVOCATION_FAILED, probablemente Supabase env vars vacías/rotadas). Si se quisiera rollback al webhook Vercel habría que arreglar primero esas env vars.
