import { expect, type APIRequestContext, type Page } from '@playwright/test'

export const API = 'http://localhost:8080'

// One login per run: the login endpoint is rate-limited, so logging in per call gets 429s.
let cached: string | undefined
export async function token(request: APIRequestContext) {
  if (cached) return cached
  const r = await request.post(`${API}/auth/login`, { data: { username: 'testshop', password: 'test123' } })
  cached = (await r.json()).token as string
  return cached
}

export async function call(request: APIRequestContext, method: string, path: string, body?: unknown) {
  const tok = await token(request)
  const r = await request.fetch(`${API}${path}`, {
    method, data: body, headers: { Authorization: `Bearer ${tok}` },
  })
  return { status: r.status(), body: await r.json().catch(() => null) }
}

export interface Inv { product_id: string; batch_id: string; name: string; company_name: string; batch_no: string; expiry_date: string; available_stock: number; selling_price: number; mrp: number }

export async function inventory(request: APIRequestContext): Promise<Inv[]> {
  return (await call(request, 'GET', '/inventory')).body
}

const today = () => new Date().toISOString().slice(0, 10)
export const sellable = (r: Inv) => r.available_stock > 0 && r.expiry_date > today() && Number(r.selling_price) > 0

/** Real products from the copied data: one with a single sellable batch, one with several. */
export async function pickProducts(request: APIRequestContext) {
  const rows = await inventory(request)
  const names = rows.map(r => r.name.toLowerCase())
  // A name no other product's name contains, so typing it highlights only that product.
  const unique = (n: string) => names.filter(x => x.includes(n.toLowerCase())).length === rows.filter(r => r.name === n).length
  const batchCount = new Map<string, number>()
  for (const r of rows) batchCount.set(r.product_id, (batchCount.get(r.product_id) ?? 0) + 1)
  const byProduct = new Map<string, Inv[]>()
  for (const r of rows.filter(sellable)) byProduct.set(r.product_id, [...(byProduct.get(r.product_id) ?? []), r])
  const all = [...byProduct.values()].filter(b => unique(b[0].name))
  const single = all.find(b => b.length === 1 && batchCount.get(b[0].product_id) === 1 && b[0].available_stock >= 10)?.[0]
  const multi = all.find(b => b.length >= 2 && new Set(b.map(x => x.batch_no)).size >= 2)
  expect(single, 'seed data has a product with one sellable batch').toBeTruthy()
  return { single: single!, multi }
}

export const newPhone = () => '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0')

/** Bills open a print tab; close it so it can't steal focus from the test. */
export function closePrintTabs(page: Page) {
  page.context().on('page', p => { p.close().catch(() => {}) })
}

export const productBox = (page: Page, n = 0) => page.locator('tr[data-row] [data-field="product"]').nth(n)
export const qtyBox = (page: Page, n = 0) => page.locator('tr[data-row] [data-field="qty"]').nth(n)

/** Fail the test on any browser console error or uncaught exception (e.g. hydration mismatches). */
export function failOnConsoleErrors(page: Page) {
  const errors: string[] = []
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 500)) })
  page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 500)))
  return () => expect(errors, 'browser console errors').toEqual([])
}

/** Type a product and pick it with Enter, once the list has the match highlighted (the catalog loads in the background). */
export async function pickProduct(page: Page, name: string, row = 0) {
  await productBox(page, row).fill(name)
  await expect(page.locator('div.fixed button[data-i]').first()).toBeVisible()
  await page.keyboard.press('Enter')
}
