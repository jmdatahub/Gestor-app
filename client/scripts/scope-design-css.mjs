/**
 * Combine + scope a design's base.css and premium.css into one overlay file
 * gated by [data-design='X'].
 */

import { readFileSync, writeFileSync } from 'node:fs'
import postcss from 'postcss'

function scopeSelector(selector, scope) {
  const trimmed = selector.trim()
  if (/^:root$/.test(trimmed)) return `:root${scope}`
  if (/^\[data-theme=/.test(trimmed)) return `${scope}${trimmed}, ${scope} ${trimmed}`
  if (/^(from|to|\d+%)$/.test(trimmed)) return trimmed
  return `${scope} ${trimmed}`
}

function scopeSelectorList(selectorList, scope) {
  const parts = []
  let depth = 0, current = ''
  for (const ch of selectorList) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) { parts.push(current); current = '' }
    else current += ch
  }
  if (current.trim()) parts.push(current)
  return parts.map(p => scopeSelector(p, scope)).join(', ')
}

function transform(css, designKey) {
  const scope = `[data-design='${designKey}']`
  const root = postcss.parse(css)

  // Strip top-level @import (fonts must be hoisted to index.html)
  root.walkAtRules('import', (n) => n.remove())

  function walkRules(container, insideKeyframes = false) {
    container.each(node => {
      if (node.type === 'rule') {
        if (insideKeyframes) return
        node.selector = scopeSelectorList(node.selector, scope)
      } else if (node.type === 'atrule') {
        const name = node.name.toLowerCase()
        if (name === 'keyframes' || name === '-webkit-keyframes') return
        if (name === 'font-face') return
        if (node.nodes) walkRules(node, false)
      }
    })
  }
  walkRules(root)
  return root.toString()
}

const [, , designKey, baseCss, premiumCss, outputPath] = process.argv
if (!designKey || !baseCss || !premiumCss || !outputPath) {
  console.error('Usage: node scope-design-css.mjs <key> <base.css> <premium.css> <out.css>')
  process.exit(1)
}

const baseSrc = readFileSync(baseCss, 'utf8')
const premiumSrc = readFileSync(premiumCss, 'utf8')

const baseScoped = transform(baseSrc, designKey)
const premiumScoped = transform(premiumSrc, designKey)

const banner = `/* ============================================================
   ${designKey.toUpperCase()} — scoped overlay (auto-generated)
   Activate with: <html data-design='${designKey}'>
   ============================================================ */

`

writeFileSync(outputPath, banner + baseScoped + '\n\n/* ---- premium overrides ---- */\n\n' + premiumScoped)
console.log(`✓ ${designKey} → ${outputPath}`)
