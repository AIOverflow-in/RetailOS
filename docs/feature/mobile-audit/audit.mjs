// Responsive regression check. Fails if a screen needs horizontal scrolling at a given width.
//   npm i playwright && node audit.mjs [width] [baseUrl]
// Default: 390px against production. Screenshots land in ./shots.
//
// Run it at BOTH ends: `node audit.mjs 390` is the mobile target,
// `node audit.mjs 1280` (and 1440/1920) is the desktop no-regression guard,
// which must stay at 0 failures through every phase of the retrofit.
import { chromium } from 'playwright'
import fs from 'fs'

const W    = Number(process.argv[2] || 390)
const BASE = process.argv[3] || 'https://app.sellos.in'
const USER = process.env.AUDIT_USER || 'testshop'
const PASS = process.env.AUDIT_PASS || 'test123'
const OUT  = new URL('./shots/', import.meta.url).pathname
fs.mkdirSync(OUT, { recursive: true })

const ROUTES = [
  ['dashboard', '/dashboard'], ['billing', '/billing'], ['inventory', '/inventory'],
  ['inventory-add', '/inventory/add'], ['inventory-adjustments', '/inventory/adjustments'],
  ['distributors', '/distributors'], ['orders', '/orders'], ['customers', '/customers'],
  ['reports', '/reports'], ['settings', '/settings'],
  // detail routes are appended at runtime once an order id is known
]

// Screens outside the dashboard shell — no sidebar, so they are checked without login.
const PUBLIC_ROUTES = [['login', '/login'], ['super-admin-login', '/super-admin/login']]

// The real failure signal: does the page require horizontal scrolling to be used?
// `main` carries overflow-y-auto, whose used overflow-x is `auto`, so overflowing
// content is reachable by scrolling sideways — reachable, but not usable.
const MEASURE = (vw) => {
  const main = document.querySelector('main')
  const mainW = main ? main.clientWidth : 0
  const mainScrollW = main ? main.scrollWidth : 0
  // elements spilling past the viewport, excluding those inside a deliberate
  // overflow-x-auto table wrapper (those are an accepted desktop-table escape hatch)
  const inTableScroller = (el) => {
    for (let n = el.parentElement; n && n !== main; n = n.parentElement) {
      if (n.className?.toString?.().includes('overflow-x-auto')) return true
    }
    return false
  }
  const spill = []
  for (const el of document.querySelectorAll('main *')) {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height || r.right <= vw + 1) continue
    if (!inTableScroller(el)) spill.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className?.toString?.() || '').slice(0, 90),
      right: Math.round(r.right), w: Math.round(r.width),
    })
  }
  const small = [...document.querySelectorAll('button,a,[role="button"],input,select')]
    .filter(el => { const r = el.getBoundingClientRect(); return r.width && r.height && r.height < 40 }).length
  return {
    mainWidth: mainW,
    needsHScroll: mainScrollW > mainW + 1,
    hScrollBy: Math.max(0, mainScrollW - mainW),
    spill: spill.slice(0, 15), spillCount: spill.length,
    smallTapTargets: small,
  }
}

const browser = await chromium.launch({ channel: 'chrome' })
const page = await (await browser.newContext({
  viewport: { width: W, height: 844 }, deviceScaleFactor: 2,
  isMobile: W < 700, hasTouch: W < 700,
})).newPage()
page.setDefaultTimeout(45000)

let failed = 0
const report = []

// --- screens with no sidebar (login, super-admin login) ---
for (const [name, route] of PUBLIC_ROUTES) {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const over = await page.evaluate((vw) => [...document.querySelectorAll('body *')]
    .filter(el => { const r = el.getBoundingClientRect(); return r.width && r.height && r.right > vw + 1 }).length, W)
  report.push({ name, route, viewportOverflow: over })
  if (over > 0) failed++
  console.log(`${over ? 'FAIL' : 'ok  '} ${name.padEnd(22)} (no sidebar) elementsPastViewport=${over}`)
}

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('input[autocomplete="username"]')
await page.fill('input[autocomplete="username"]', USER)
await page.fill('input[type="password"]', PASS)
await page.click('button[type="submit"]')
await page.waitForURL('**/dashboard')
await page.waitForTimeout(3000)

// discover a real order id so the detail + printable-bill routes get covered too
await page.goto(`${BASE}/orders`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3000)
const orderId = await page.evaluate(() => {
  const a = [...document.querySelectorAll('a[href^="/orders/"]')].map(x => x.getAttribute('href'))
    .find(h => h && h.split('/').length === 3 && h.split('/')[2].length > 10)
  return a ? a.split('/')[2] : null
})
if (orderId) ROUTES.push(['order-detail', `/orders/${orderId}`], ['bill-print', `/bill/${orderId}`])
else console.log('!  could not find an order id — detail and bill routes skipped')

for (const [name, route] of ROUTES) {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const m = await page.evaluate(MEASURE, W)
  report.push({ name, route, ...m })
  await page.screenshot({ path: `${OUT}${W}-${name}.png`, fullPage: true })
  const bad = m.needsHScroll || m.spillCount > 0
  if (bad) failed++
  console.log(`${bad ? 'FAIL' : 'ok  '} ${name.padEnd(22)} main=${m.mainWidth}px hScroll=${m.hScrollBy}px spill=${m.spillCount} tapTargets<40px=${m.smallTapTargets}`)
  if (bad) for (const c of m.spill.slice(0, 3)) console.log(`       \u21b3 ${c.tag} w=${c.w} right=${c.right} | ${c.cls}`)
}

fs.writeFileSync(`${OUT}report-${W}.json`, JSON.stringify(report, null, 2))
await browser.close()
const total = ROUTES.length + PUBLIC_ROUTES.length
console.log(`\n${failed}/${total} screens fail at ${W}px`)
if (W >= 1280) console.log('(at desktop widths this doubles as the no-regression guard: expect 0 failures)')
process.exit(failed ? 1 : 0)
