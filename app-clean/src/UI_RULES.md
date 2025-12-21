# REGLAS DEL SISTEMA DE DISEÑO UI (UI_RULES)

> **ESTADO:** ACTIVO
> **FECHA EFECTIVA:** 2025-12-18
> **AMBITO:** Toda la aplicación (`src/`)

Estas reglas son vinculantes para mantener la consistencia visual, la experiencia de usuario y la mantenibilidad del proyecto `app-clean`.

## 1. PROHIBICIONES ESTRICTAS (DO NOT)

### ❌ NO Usar `<select>` Nativo
El elemento `<select>` nativo tiene estilado inconsistente entre navegadores y limitaciones de UX.
*   **Prohibido:** `<select>...</select>`
*   **Alternativa:** Usar `<UiSelect />`

### ❌ NO Usar `<input type="date">`
El calendario nativo del navegador rompe la estética y varía drásticamente (iOS vs Chrome vs Firefox).
*   **Prohibido:** `<input type="date" />`
*   **Alternativa:** Usar `<UiDatePicker />`

### ❌ NO Crear Modales Manuales
No usar overlays `div` con `position: fixed` y manejo de z-index manual.
*   **Prohibido:** `<div className="modal-overlay">...</div>`
*   **Alternativa:** Usar `<UiModal>...</UiModal>`

### ❌ NO Usar Inputs "Sueltos" en Formularios
Todo input debe tener etiqueta, manejo de error y hint estandarizado.
*   **Prohibido:** `<input className="border..." />` suelto.
*   **Alternativa:** Envolver en `<UiField>` o usar componentes que ya lo integren (`UiInput`, `UiSelect`).

---

## 2. PREFERENCIAS (COMPONENTES PRIMITIVOS)

Todos los componentes base residen en `src/components/ui/`.

| Componente | Uso | Notas |
| :--- | :--- | :--- |
| **`UiField`** | Wrapper de campos | Maneja Label, Error, Hint y espaciado vertical. |
| **`UiInput`** | Texto corto, email, password | Soporta iconos izquierda/derecha. |
| **`UiNumber`** | Números, importes | Impide scroll accidental. |
| **`UiTextarea`** | Texto largo | Altura mínima controlada, resize vertical. |
| **`UiSelect`** | Selección simple | Dropdown custom con portal. Soporta búsqueda. |
| **`UiDatePicker`** | Fechas | Popover con calendario consistente. |
| **`UiModal`** | Ventanas modales | Overlay, animaciones, cierre con ESC/Click-fuera. |
| **`UiSwitch`** | Toggles booleanos | Reemplazo de checkboxes para activaciones. |
| **`UiCheckbox`** | Selección múltiple | Checkbox estilado consistente. |

---

## 3. ESTILOS (CSS)

*   Toda clase nueva de UI primitiva debe ir en `src/index.css` bajo la sección `/* UI PRIMITIVES */`.
*   Usar variables CSS (`var(--primary)`, `var(--radius-md)`) en lugar de valores hardcodeados.
*   Animaciones estándar: `var(--motion-fast)` y `var(--motion-med)`.

---

## 4. CHECKLIST DE MIGRACIÓN

Al tocar un archivo "legacy":
1.  Identificar `<select>`, `type="date"`, o modales manuales.
2.  Importar los componentes `Ui*` correspondientes.
3.  Reemplazar manteniendo la lógica de estado (`value`, `onChange`).
4.  Verificar que no queden estilos inline (`style={{...}}`) innecesarios.
