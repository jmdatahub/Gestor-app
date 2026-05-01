# Guía: Multi-Design Switcher para apps React+Vite+CSS

Cómo replicar el patrón de "elige el frontend que quieras desde Ajustes" en
otra aplicación. Funciona para cualquier app React/Vite/Next con CSS plano,
CSS-in-JS, o Tailwind con tokens custom.

> **Idea central:** Múltiples sistemas de diseño coexisten en el mismo bundle,
> activados por un atributo `data-design` en `<html>`. Sin recargar, sin
> Sub-rutas, sin lazy loading.

---

## 1. Anatomía del patrón

```
┌─────────────────────────────────────────────────┐
│ <html data-design="crafted" data-theme="light"> │
└─────────────────────────────────────────────────┘
                     │
        ┌────────────┼─────────────┐
        ▼            ▼             ▼
   base.css     design-X.css   componentes
   (resets +    (5 archivos    React (sin
    fallback     scopeados,    cambios)
    tokens)     1 por estilo)
```

- **base.css** — resets CSS, animaciones compartidas, fallback tokens
  (los que aplican cuando no hay diseño elegido). Y **estilos del switcher**
  en sí (los design-card del Settings).
- **design-X.css** — un archivo por estilo. **Cada selector está prefijado**
  con `[data-design='X']` para que solo aplique cuando ese diseño esté activo.
- **layout.css / components.css / forms.css / etc.** — tu CSS legacy. Sigue
  funcionando, los tokens (`var(--primary)`, etc.) los resuelve quien tenga
  el atributo `data-design` activo.

---

## 2. Pasos a seguir

### Paso 1 — Crea cada estilo como un archivo CSS aparte

Para cada estilo (Mono Linear, Aurora, Bento, Editorial...) escribe un
archivo CSS **completo y autosuficiente**:

```css
/* original mono-source.css (sin scopear todavía) */
:root {
  --primary: #3D63DD;
  --bg-body: #FFFFFF;
  --radius-md: 6px;
  --font-sans: 'Inter Tight', sans-serif;
}

[data-theme='dark'] {
  --bg-body: #08090A;
  --text-primary: #FAFAFA;
}

body { background: var(--bg-body); }

.btn-primary {
  background: var(--primary);
  color: white !important;
}
```

> **Tip:** lo más rápido es delegar la escritura de cada estilo a un agente
> diferente con un brief muy concreto (paleta, radii, sombras, sidebar, KPI
> cards, modales, auth). Pueden trabajar en paralelo, cada uno en su worktree
> aparte. Después se integran.

### Paso 2 — Escribe el script de scoping

Mete cada CSS en un nuevo selector raíz para que solo aplique cuando el
diseño esté activo. Es mecánico y se automatiza con PostCSS:

```js
// scripts/scope-design-css.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import postcss from 'postcss'

function scopeSelector(selector, scope) {
  const t = selector.trim()
  if (/^:root$/.test(t)) return `:root${scope}`                          // :root → :root[scope]
  if (/^\[data-theme=/.test(t)) return `${scope}${t}, ${scope} ${t}`     // [data-theme=...] → combinada
  if (/^(from|to|\d+%)$/.test(t)) return t                               // dentro de @keyframes
  return `${scope} ${t}`                                                 // resto: prefijo simple
}

function scopeSelectorList(list, scope) {
  // split por comas respetando paréntesis
  const parts = []; let depth = 0, cur = ''
  for (const ch of list) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) { parts.push(cur); cur = '' }
    else cur += ch
  }
  if (cur.trim()) parts.push(cur)
  return parts.map(p => scopeSelector(p, scope)).join(', ')
}

function transform(css, key) {
  const scope = `[data-design='${key}']`
  const root = postcss.parse(css)
  root.walkAtRules('import', n => n.remove())  // las @import de fuentes van a index.html
  function walk(c) {
    c.each(n => {
      if (n.type === 'rule') n.selector = scopeSelectorList(n.selector, scope)
      else if (n.type === 'atrule') {
        const name = n.name.toLowerCase()
        if (['keyframes', '-webkit-keyframes', 'font-face'].includes(name)) return
        if (n.nodes) walk(n)
      }
    })
  }
  walk(root)
  return root.toString()
}

const [, , key, basePath, premiumPath, outPath] = process.argv
const baseScoped = transform(readFileSync(basePath, 'utf8'), key)
const premiumScoped = transform(readFileSync(premiumPath, 'utf8'), key)
writeFileSync(outPath, baseScoped + '\n' + premiumScoped)
console.log(`✓ ${key} → ${outPath}`)
```

Ejecuta para cada diseño:

```bash
node scripts/scope-design-css.mjs mono mono-base.css mono-premium.css src/styles/design-mono.css
node scripts/scope-design-css.mjs aurora aurora-base.css aurora-premium.css src/styles/design-aurora.css
# etc.
```

Resultado:

```css
/* design-mono.css generado */
:root[data-design='mono'] {
  --primary: #3D63DD;
  --bg-body: #FFFFFF;
}
[data-design='mono'][data-theme='dark'], [data-design='mono'] [data-theme='dark'] {
  --bg-body: #08090A;
}
[data-design='mono'] body { background: var(--bg-body); }
[data-design='mono'] .btn-primary { background: var(--primary); color: white !important; }
```

### Paso 3 — Importa los design-X.css en orden

```css
/* index.css */
@import './styles/base.css';        /* resets + fallback tokens + estilos del picker */
@import './styles/layout.css';      /* legacy (sigue funcionando con tokens) */
@import './styles/components.css';  /* legacy */
/* ... */
@import './styles/design-crafted.css';
@import './styles/design-mono.css';
@import './styles/design-aurora.css';
@import './styles/design-bento.css';
@import './styles/design-editorial.css';
```

### Paso 4 — Bootstrap pre-React (evita FOUC)

En `index.html`, antes del `<script type="module" src="main.tsx">`, mete
un script inline que aplique el atributo lo antes posible:

```html
<script>
  (function () {
    try {
      var d = localStorage.getItem('app_design') || 'crafted';
      var t = localStorage.getItem('app_theme') || 'light';
      document.documentElement.setAttribute('data-design', d);
      document.documentElement.setAttribute('data-theme', t);
    } catch (e) {
      document.documentElement.setAttribute('data-design', 'crafted');
    }
  })();
</script>
```

Sin esto, hay un parpadeo de 100-300ms con el diseño "default" antes de que
React monte y aplique el guardado.

### Paso 5 — Carga las fuentes de TODOS los diseños

Si Mono usa Inter Tight + JetBrains Mono y Editorial usa Fraunces, todas
deben estar disponibles aunque no estén activas. Mete los `<link>` de
Google Fonts a `index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
```

(Si el bundle pesa demasiado, usa `font-display: swap` y considera lazy
load por diseño activo — pero para 4-5 fuentes el coste es despreciable.)

### Paso 6 — Contexto + UI del switcher

```tsx
// SettingsContext.tsx
export type Design = 'crafted' | 'mono' | 'aurora' | 'bento' | 'editorial'

export const DESIGN_OPTIONS = [
  { value: 'crafted', label: 'Premium Crafted', description: '...', previewColors: { bg: '#FAFAF7', surface: '#FFFFFF', accent: '#5B47E0', text: '#1F1E1B' } },
  { value: 'mono',    label: 'Mono Linear',     description: '...', previewColors: { ... } },
  // ... 5 entradas
]

// En el provider:
useEffect(() => {
  const root = document.documentElement
  root.setAttribute('data-design', settings.design)
  localStorage.setItem('app_design', settings.design)
}, [settings.design])
```

UI:

```tsx
// SettingsPanel.tsx
<div className="design-picker-grid">
  {DESIGN_OPTIONS.map(opt => (
    <button
      key={opt.value}
      className={`design-card ${settings.design === opt.value ? 'design-card--active' : ''}`}
      onClick={() => updateSettings({ design: opt.value })}
    >
      <div className="design-card__preview" style={{ background: opt.previewColors.bg }}>
        <div className="design-card__preview-card" style={{ background: opt.previewColors.surface }}>
          <span style={{ background: opt.previewColors.accent }} />
        </div>
      </div>
      <div className="design-card__name">{opt.label}</div>
      <div className="design-card__desc">{opt.description}</div>
    </button>
  ))}
</div>
```

Con un mini preview de bg+surface+accent por diseño, el usuario ve
diferencias antes de elegir.

### Paso 7 — Casos especiales por diseño

Algunos diseños fuerzan dark mode (Aurora) o tienen requisitos peculiares.
Maneja esto en el effect del context:

```ts
useEffect(() => {
  const root = document.documentElement
  root.setAttribute('data-design', settings.design)
  // Aurora visualmente requiere dark — si el user elige 'auto', forzar dark
  if (settings.design === 'aurora' && settings.theme === 'auto') {
    root.setAttribute('data-theme', 'dark')
  }
}, [settings.design, settings.theme])
```

---

## 3. Reglas para que el patrón funcione bien

### ✅ Sí

1. **Tokens en `:root`**, todo lo demás usando `var(--xxx)`.
2. **`!important` libremente en design-X.css**: porque varios diseños tienen
   reglas que matchean (ej. `.btn-primary`) y necesitas que la activa gane.
   La especificidad del prefix `[data-design='X']` ya filtra cuál se aplica;
   `!important` solo asegura ganar a CSS legacy del mismo proyecto.
3. **Fallback tokens en base.css** dentro de `:root { ... }` sin scope. Así
   si nunca eligieron diseño, la app sigue viéndose decente.
4. **Animaciones compartidas** (`@keyframes`) en base.css. Cada diseño puede
   usarlas sin redefinir.
5. **Densidad y theme** son ortogonales al diseño (`data-density`, `data-theme`).

### ❌ No

1. **No mezclar @import de fuentes en cada design-X.css.** El script de
   scoping las quita; hoistéa a `<head>` de `index.html`.
2. **No olvidar el bootstrap pre-React** o tendrás flash del default al
   guardado.
3. **No esperes que Tailwind utility classes** (ej. `bg-gray-100`) se
   reescriban automáticamente. Si usas Tailwind, haz que las utilities
   resuelvan a `var(--token)` y deja que cada diseño redefina los tokens.
4. **No mezcles selectores que no se prefijan bien**. El script trata bien
   `:root`, `[data-theme=...]`, comas y nesting. Si tu CSS tiene
   pseudo-elementos a nivel raíz (`::selection`), revisa el output a mano.

---

## 4. Coste / Beneficio

| Aspecto | Coste |
|---|---|
| Bundle CSS | +60KB por diseño (gzipped ~12KB cada uno → ~50-60KB total para 5) |
| Build time | despreciable (los design-X.css se generan offline con `node script.mjs`) |
| Runtime | 1 cambio de atributo + repaint. ~16ms en hardware moderno. |
| Mantenimiento | medio: cualquier cambio a una primitiva (`.btn`) requiere revisar 5 sitios. Compensa con el script de scoping si la primitiva nueva nace primero como diff de un diseño. |

---

## 5. Cuándo NO usar este patrón

- Si solo quieres dark/light mode → usa `data-theme` y suficiente.
- Si los diseños tienen estructuras de componentes diferentes (no solo CSS,
  sino layouts distintos) → entonces necesitas algo más cercano a temas
  React (Context + componentes intercambiables).
- Si solo cambias 2-3 tokens (color brand) → no necesitas todo este andamio,
  sustituye los tokens y ya.

---

## 6. Snippet del estilo del picker (copy-paste)

```css
.design-picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}
.design-card {
  display: flex; flex-direction: column; gap: 6px;
  padding: 10px;
  background: var(--bg-card);
  border: 1.5px solid var(--border-color);
  border-radius: 12px;
  cursor: pointer; text-align: left;
  font-family: inherit; color: var(--text-primary);
  transition: border-color 140ms, box-shadow 140ms, transform 140ms;
}
.design-card:hover { border-color: var(--text-muted); box-shadow: var(--shadow-md); }
.design-card:active { transform: scale(0.99); }
.design-card--active {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}
.design-card__preview {
  width: 100%; height: 64px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
}
.design-card__preview-card {
  width: 70%; height: 38px; border-radius: 6px;
  padding: 6px; display: flex; flex-direction: column;
  justify-content: space-between;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
}
.design-card__preview-bar { width: 50%; height: 4px; border-radius: 2px; }
.design-card__name { display: flex; justify-content: space-between; font-weight: 600; font-size: 13px; }
.design-card__desc { font-size: 11px; color: var(--text-muted); line-height: 1.4; }
```

---

## 7. Tiempo estimado

Para un proyecto medio (~50 componentes, ~3000 líneas CSS):

- Diseñar y escribir 1 estilo nuevo: 4-8 horas.
- Escribir el script de scoping: 1 hora (úsalo de aquí).
- Integrar Settings + bootstrap + persistencia: 1-2 horas.
- Testing cross-design: 1 hora.

Para 5 estilos en paralelo (con 5 agentes): ~6-8h reloj total.
Para 5 estilos secuenciales (1 dev): 25-40h.

---

## 8. Plantilla de prompt para un agente que diseñe un nuevo estilo

```
Eres diseñador. Crea el sistema visual completo para una app React de
finanzas. Tu worktree: <PATH>. Edita SOLO archivos dentro de ese path.

# DIRECCIÓN: "<NOMBRE>"
<descripción 1-2 frases del vibe>

## TOKENS
- Paleta: <hex codes específicos>
- Tipografía: <familia + tamaños + tracking>
- Forma: <radii + bordes + sombras>
- Sidebar: <descripción>
- Buttons: <bg, color, radius, hover>
- Cards: <descripción>
- KPI cards: <descripción>
- Modals: <descripción>
- Auth page: <descripción>

## ARCHIVOS A EDITAR
1. client/src/styles/base.css — REWRITE :root y [data-theme='dark']
2. client/src/styles/premium.css — CREATE con overrides de las clases:
   <lista exhaustiva de clases que existen>
3. client/src/index.css — añadir @import './styles/premium.css'

## PROHIBIDO
- No tocar .tsx (excepto main.tsx para forzar tema si tu diseño lo requiere)
- No tocar package.json, vite.config.ts, index.html
- No instalar paquetes

## ESTILO REQUERIMIENTOS
<3-4 reglas inviolables específicas del diseño>

Cuando termines, salida una línea: "<NOMBRE> done — N classes overridden"
y para.
```

---

¡Listo! Con esto puedes replicar el patrón en cualquier app.
