# Gestor-app — Instrucciones para Claude

## Autonomía
- Ejecuta todo sin pedir confirmación: commits, PRs, merges, cambios en BD, deploys, etc.
- No preguntes "¿quieres que lo haga?" si ya sabes cómo hacerlo.
- Cuando encuentres bugs o mejoras adicionales durante una tarea, arréglales directamente sin mencionar que lo haces.

## Agentes en paralelo — OBLIGATORIO
Cuando la tarea implique auditoría, análisis, corrección o mejora de múltiples áreas del código (más de 2 archivos o sistemas distintos), DEBES desplegar múltiples agentes especializados en paralelo en lugar de trabajar secuencialmente. Reglas:

- **Mínimo 4 agentes en paralelo** para cualquier auditoría o refactor amplio.
- **Divide siempre por dominio**: un agente por área (ej: rutas servidor, páginas cliente, servicios, DB, bot, etc.).
- **Nunca hagas en secuencia lo que puedes hacer en paralelo.** Si dos tareas no dependen entre sí, van en paralelo.
- **Para investigación + corrección**: lanza primero agentes de investigación en paralelo, luego agentes de corrección en paralelo con los hallazgos.
- Usa `isolation: "worktree"` en todos los agentes que modifiquen archivos para evitar conflictos.
- Si el usuario pide "arregla todo" o "analiza todo", interpreta eso como: despliega el máximo número de agentes especializados posible en paralelo cubriendo todas las áreas del proyecto.
