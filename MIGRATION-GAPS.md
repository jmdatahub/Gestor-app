# Migración Vercel → VPS — Inventario de gaps (2026-04-30)

> Auditoría completa de qué se ha migrado, qué sigue dependiendo de Vercel y qué hay que portar antes de dar de baja `app-clean-five.vercel.app` y `gestor-app-ashy.vercel.app`.

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

### 2. Webhook de Telegram ✅ PORTADO

| Endpoint | Destino |
|---|---|
| `POST /api/v1/telegram-webhook` | `server/routes/telegram.routes.ts` |

**Acciones pendientes**: actualizar webhook URL en BotFather a `https://finanzas.soulia.info/api/v1/telegram-webhook`. Variables requeridas: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`.

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
6. **Pendiente**: actualizar webhook URL en BotFather → `https://finanzas.soulia.info/api/v1/telegram-webhook`
7. **Pendiente**: integrar API pública con tokens.
8. **Pendiente**: validar Sentry y crons.
9. **Pendiente**: cutover CRM (`FINANCE_API_URL` → finanzas.soulia.info).
10. **Tras 1-2 semanas estables**: borrar proyectos Vercel.

## ❌ NO borrar Vercel todavía

`app-clean-five.vercel.app` sigue siendo la fuente de los `/api/crm-sync/*` que el CRM usa. Hasta que esos endpoints estén en el VPS, `app-clean-five` debe seguir vivo (el frontend en `gestor-app-ashy` ya no se usa porque los usuarios entran a `finanzas.soulia.info`, pero las funciones serverless del repo siguen sirviendo al CRM).
