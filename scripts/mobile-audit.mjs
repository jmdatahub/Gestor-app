/* eslint-disable */
import { chromium } from 'playwright'
import fs from 'fs/promises'
import path from 'path'

const TOKEN = (await fs.readFile(path.resolve('scripts/.test-token.txt'), 'utf8')).trim()
const STORAGE_KEY = 'mp_urcxpp:auth_token'

const VIEWPORTS = [
  { name: '320', w: 320, h: 568 },
  { name: '375', w: 375, h: 812 },
  { name: '390', w: 390, h: 844 },
  { name: '430', w: 430, h: 932 },
  { name: '768', w: 768, h: 1024 },
]

const PAGES = [
  { id: 'dashboard', path: '/app/dashboard' },
  { id: 'movimientos', path: '/app/movimientos' },
  { id: 'movimientos-recurrentes', path: '/app/movimientos/recurrentes' },
  { id: 'movimientos-pendientes', path: '/app/movimientos/pendientes' },
  { id: 'patrimonio-cuentas', path: '/app/patrimonio' },
  { id: 'patrimonio-ahorros', path: '/app/patrimonio/ahorros' },
  { id: 'patrimonio-inversiones', path: '/app/patrimonio/inversiones' },
  { id: 'patrimonio-deudas', path: '/app/patrimonio/deudas' },
  { id: 'analisis-resumen', path: '/app/analisis' },
  { id: 'analisis-insights', path: '/app/analisis/insights' },
  { id: 'analisis-alertas', path: '/app/analisis/alertas' },
  { id: 'config', path: '/app/config' },
]

const OUT_DIR = path.resolve('scripts/audit-screenshots')

async function ensureOut() {
  await fs.rm(OUT_DIR, { recursive: true, force: true })
  await fs.mkdir(OUT_DIR, { recursive: true })
}

async function auditPage(page, p, vp, results, token) {
  await page.setViewportSize({ width: vp.w, height: vp.h })
  await page.goto(`http://localhost:5180${p.path}`, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {})
  await page.waitForTimeout(2000)

  // If we landed on /auth, re-inject token and try again
  let url = page.url()
  if (url.includes('/auth')) {
    await page.evaluate(t => localStorage.setItem('mp_urcxpp:auth_token', t), token)
    await page.goto(`http://localhost:5180${p.path}`, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {})
    await page.waitForTimeout(2500)
  }

  // Dismiss any visible toasts to clean up screenshots
  await page.evaluate(() => {
    document.querySelectorAll('.app-toast button[aria-label="Cerrar" i], .app-toast button').forEach(b => b.click?.())
  }).catch(() => {})
  await page.waitForTimeout(500)

  // Detect overflow + accessibility issues in browser context
  const audit = await page.evaluate(() => {
    const out = {
      url: location.href,
      h1: document.querySelector('.page-title')?.textContent?.trim() || document.querySelector('h1')?.textContent?.trim() || '',
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      overflowing: [],
      tinyText: [],
      tinyTouch: [],
      zeroSizeCharts: [],
      missingAlt: 0,
    }

    document.querySelectorAll('main *').forEach(el => {
      const r = el.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return
      if (r.right > window.innerWidth + 2 && r.width > 1) {
        out.overflowing.push({
          tag: el.tagName,
          cls: (el.className?.toString?.() || '').slice(0, 50),
          right: Math.round(r.right),
          width: Math.round(r.width),
          text: (el.textContent || '').slice(0, 30).trim(),
        })
      }
    })

    document.querySelectorAll('main p, main span, main label').forEach(el => {
      const fs = parseFloat(getComputedStyle(el).fontSize)
      const txt = (el.textContent || '').trim()
      if (fs > 0 && fs < 11 && txt.length > 3) {
        out.tinyText.push({
          fs: Math.round(fs * 10) / 10,
          tag: el.tagName,
          text: txt.slice(0, 30),
        })
      }
    })

    document.querySelectorAll('main button, main a').forEach(el => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0 && (r.height < 32 || r.width < 32)) {
        out.tinyTouch.push({
          tag: el.tagName,
          w: Math.round(r.width),
          h: Math.round(r.height),
          text: (el.textContent || '').slice(0, 25).trim(),
          cls: (el.className?.toString?.() || '').slice(0, 40),
        })
      }
    })

    document.querySelectorAll('.recharts-responsive-container').forEach(el => {
      const r = el.getBoundingClientRect()
      if (r.width <= 16 || r.height <= 16) {
        out.zeroSizeCharts.push({ w: r.width, h: r.height })
      }
    })

    return out
  })

  out: {
    audit.overflowing = audit.overflowing.slice(0, 8)
    audit.tinyText = audit.tinyText.slice(0, 5)
    audit.tinyTouch = audit.tinyTouch.slice(0, 6)
  }

  results.push({ page: p.id, viewport: vp.name, ...audit })

  const fname = `${p.id}_${vp.name}.png`
  await page.screenshot({ path: path.join(OUT_DIR, fname), fullPage: true })
  console.log(`✓ ${fname}  overflow=${audit.overflowing.length} tinyText=${audit.tinyText.length} tinyTouch=${audit.tinyTouch.length} zeroCharts=${audit.zeroSizeCharts.length}`)
}

async function main() {
  await ensureOut()
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  // Inject token before navigation
  await page.goto('http://localhost:5180/auth')
  await page.evaluate(t => localStorage.setItem('mp_urcxpp:auth_token', t), TOKEN)

  const results = []
  for (const p of PAGES) {
    for (const vp of VIEWPORTS) {
      try {
        await auditPage(page, p, vp, results, TOKEN)
      } catch (err) {
        console.warn(`✗ ${p.id} @ ${vp.name}: ${err?.message?.slice(0, 80) || err}`)
        results.push({ page: p.id, viewport: vp.name, error: String(err?.message || err) })
      }
    }
  }

  await fs.writeFile(path.join(OUT_DIR, '_audit.json'), JSON.stringify(results, null, 2))

  // Summary
  const byPage = {}
  for (const r of results) {
    byPage[r.page] = byPage[r.page] || { overflow: 0, tinyText: 0, tinyTouch: 0, zeroCharts: 0 }
    if (r.overflowing) byPage[r.page].overflow += r.overflowing.length
    if (r.tinyText) byPage[r.page].tinyText += r.tinyText.length
    if (r.tinyTouch) byPage[r.page].tinyTouch += r.tinyTouch.length
    if (r.zeroSizeCharts) byPage[r.page].zeroCharts += r.zeroSizeCharts.length
  }
  console.log('\n=== SUMMARY ===')
  for (const [p, s] of Object.entries(byPage)) {
    console.log(`${p}: overflow=${s.overflow} tinyText=${s.tinyText} tinyTouch=${s.tinyTouch} zeroCharts=${s.zeroCharts}`)
  }

  await browser.close()
}

main().catch(err => { console.error(err); process.exit(1) })
