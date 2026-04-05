# � Runbook: Implementación Granular Multi-Workspace

Este documento es el **Manual de Operaciones** paso a paso. No avanzamos al siguiente punto sin marcar el anterior como ✅ VERIFICADO.

---

## 🏗️ FASE 1: INFRAESTRUCTURA DE BASE DE DATOS (Estado: ✅ COMPLETADO)
**Objetivo:** Crear las tablas necesarias sin tocar NADA de lo que ya funciona.
**Riesgo:** Nulo (solo añade tablas nuevas).

### 1.1 Ejecución de Script Core
- [x] **Acción:** Ejecutar `migrations/MIG_001_v2_multi_workspace_core.sql` en Supabase SQL Editor.
- [x] **Verificación (SQL):** Ejecutar `SELECT * FROM public.organizations;` (No debe dar error, da 0 filas).
- [x] **Verificación (SQL):** Ejecutar `SELECT * FROM public.profiles;` (No debe dar error).

### 1.2 Verificación de Integridad y Seguridad
- [x] **Acción:** Ejecutar `migrations/VERIFY_MIG_001_v2.sql`.
- [x] **Check 1:** Tabla `movements` da status "PASS: Clean" (no se ha tocado).
- [x] **Check 2:** Policies de `organization_members` no incluyen INSERT.
- [x] **Check 3:** Trigger `on_auth_user_created` existe.

### 1.3 Prueba de Humo (Manual)
- [x] **Acción (SQL):** `SELECT create_organization('Test Company PTY');`
    *   *Resultado Esperado:* ERROR `User not authorized` (Correcto, seguridad activa).
- [x] **Acción (SQL):** `UPDATE profiles SET can_create_orgs = true WHERE id = auth.uid();`
- [x] **Acción (SQL):** `SELECT create_organization('Test Company PTY');`
    *   *Resultado Esperado:* Devuelve UUID (Correcto, funcionamiento OK).

---

## 🌑 FASE 2: ADAPTACIÓN DE DATOS "SHADOW" (Estado: 🔄 EN PROGRESO)
**Objetivo:** Que las tablas antiguas "soporten" empresas, pero sigan funcionando como siempre.

### 2.1 Columna Organization ID en Movements
- [ ] **Acción:** Crear script `MIG_002_movements_shadow.sql`.
    - `ALTER TABLE movements ADD COLUMN organization_id UUID REFERENCES organizations(id);`
    - `CREATE INDEX idx_movements_org ON movements(organization_id);`
- [ ] **Verificación:** La App carga el dashboard normalmente (porque la columna es NULL por defecto).

### 2.2 Actualización de RLS (Movements)
- [ ] **Acción:** Modificar policies de `movements`.
    - Lógica nueva: `(organization_id IS NULL AND user_id = auth.uid()) OR (organization_id IS NOT NULL AND ... member check ...)`
- [ ] **Verificación:** Dashboard personal sigue funcionando igual.

### 2.3 Repetir para Catálogos
- [ ] **Acción:** Mismos pasos para tabla `accounts`.
- [ ] **Acción:** Mismos pasos para tabla `categories`.
- [ ] **Acción:** Mismos pasos para tabla `recurring_rules`.

---

## ⚛️ FASE 3: FRONTEND - CONTEXTO Y ESTADO
**Objetivo:** Que React "sepa" en qué empresa estamos.

### 3.1 Workspace Context
- [ ] **Acción:** Crear `src/context/WorkspaceContext.tsx`.
- [ ] **Lógica:**
    - State: `activeWorkspace` (Object or Null).
    - Effect: Al cargar, fetch de `/rpc/get_my_organizations`.
- [ ] **Verificación:** Logs en consola muestran "Workspace Context Clean".

### 3.2 Inyección Global
- [ ] **Acción:** Envolver `App.tsx` con `<WorkspaceProvider>`.
- [ ] **Verificación:** App no se rompe pantalla blanca.

### 3.3 Selector "Developer"
- [ ] **Acción:** Crear componente temporal en header: `<select onChange={changeWorkspace}>`.
- [ ] **Verificación:** Visualmente existe. Al cambiar, `activeWorkspace` cambia en React DevTools.

---

## 🔌 FASE 4: CONEXIÓN DE SERVICIOS
**Objetivo:** Que los datos cambien cuando mueves el selector.

### 4.1 Refactor movementService
- [ ] **Acción:** Modificar `fetchMovements(userId, orgId?)`.
- [ ] **Verificación:**
    - Selector en "Personal" -> Carga datos.
    - Selector en "Test Company" -> Carga 0 datos (Correcto).

### 4.2 Resto de Servicios
- [ ] **Acción:** `accountService`, `summaryService` (Dashboard).
- [ ] **Verificación Completa:** Cambiar selector limpia todo el dashboard a 0€ y volver a Personal restaura todo.

---

## �️ FASE 5: UI DE GESTIÓN (Final)
**Objetivo:** Que el usuario final pueda hacer esto sin saber SQL.

### 5.1 Pantalla "Mis Organizaciones"
- [ ] Lista de empresas donde soy miembro.
- [ ] Botón "Crear Nueva" (llama a RPC).

### 5.2 Pantalla "Miembros"
- [ ] Lista de gente en la org activa.
- [ ] Botón "Invitar Email" (llama a RPC).

---

## 🔙 PLAN DE ROLLBACK (Emergencia)
Si en cualquier momento de la FASE 2 o 3 la app "Personal" deja de funcionar:
1.  **Backend:** `ALTER TABLE movements DROP COLUMN organization_id;` (Vuelve al estado original).
2.  **Frontend:** Revertir commit en Git.
