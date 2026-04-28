# Auditoría: Cuentas Jerárquicas y Roll-up

**Fecha:** 17/12/2025
**Estado:** Completado (v1.0)

## 1. Qué hace la mejora
Esta funcionalidad introduce el concepto de **jerarquía de cuentas** en la aplicación.
- Permite que una cuenta tenga una "Cuenta Padre" (`parent_account_id`).
- Habilita la organización en árbol (e.g., "Banco X" -> "Cuenta Corriente" / "Tarjeta Crédito").
- Permite visualizar los saldos de forma individual o agregada (Roll-up).

## 2. Cómo funciona el Roll-up
El "Roll-up" es una configuración visual y de exportación controlada globalmente y por página:
- **Activado:** Los saldos de las subcuentas se suman automáticamente a la cuenta raíz (nivel superior). En los listados, se muestran solo las cuentas padre con el saldo total acumulado.
- **Desactivado:** Cada cuenta se muestra por separado con su saldo individual, independientemente de su posición en la jerarquía.
- **Persistencia:** La preferencia se guarda en `SettingsContext` (localStorage) bajo la clave `rollupAccountsByParent`.

## 3. Tablas y Base de Datos
### Tabla `accounts`
- Se añadió la columna `parent_account_id` (UUID, FK a `accounts.id`).
- Restricción: Una cuenta no puede ser padre de sí misma.

### Seguridad (RLS / Triggers)
- Se implementó `secure_account_hierarchy.sql`.
- **Trigger:** `check_account_parent_ownership` (ejecuta `validate_account_parent_same_user`).
- **Regla:** Impide asignar una cuenta padre que no pertenezca al mismo `user_id` del usuario actual, evitando corrupción de datos entre usuarios.

## 4. Componentes Clave Modificados
- **`accountService.ts`:** Métodos `buildAccountTree`, `getAccountsWithBalances`, `flattenAccountTree`.
- **`summaryService.ts`:** Lógica centralizada de agregación (`getAccountBalancesSummary`).
- **`exportService.ts`:** Soporte para rutas completas ("Padre / Hijo") y exportación con opción de roll-up.
- **`SettingsContext.tsx`:** Nueva opción global `rollupAccountsByParent`.
- **Páginas:**
    - `SummaryPage`: Toggle para activar/desactivar agrupación.
    - `Dashboard`: Widget "Top Cuentas" respeta la configuración global.
    - `ExportPage`: Checkbox de agrupación por defecto según configuración.
    - `AccountsList`: Visualización jerárquica (indentación).

## 5. Limitaciones Actuales (Fuera de alcance v1)
- **Drag & Drop:** No se pueden reordenar cuentas arrastrando en la UI.
- **Reportes por Sub-árbol:** Los reportes filtran por cuenta individual, no por "rama completa" automáticamente (salvo en la vista de resumen general).
- **Ciclos Profundos:** La validación de ciclos complejos (A->B->C->A) se confía a la UI y validación básica, aunque el trigger previene el ciclo directo (A->A).

## 6. Puntos de Extensión Futura
- Implementar componente de árbol colapsable (`TreeItem`).
- Añadir filtro "Incluir subcuentas" en el buscador de movimientos.
- Gráficos de evolución comparativa por ramas de cuentas.
