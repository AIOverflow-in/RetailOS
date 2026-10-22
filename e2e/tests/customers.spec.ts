import { test, expect, type APIRequestContext } from '@playwright/test'
import { call, newPhone, pickProducts } from './helpers'

async function bill(request: APIRequestContext, phone: string, extra: Record<string, unknown>) {
  const { single } = await pickProducts(request)
  const r = await call(request, 'POST', '/orders', {
    client_ref: crypto.randomUUID(), is_in_state: true, payment_mode: 'cash', phone,
    items: [{ batch_id: single.batch_id, product_name: single.name, batch_no: single.batch_no, qty: 1, sale_price: Number(single.selling_price), gst_rate: 0 }],
    ...extra,
  })
  expect(r.status, JSON.stringify(r.body)).toBe(201)
  return r.body as { order_id: string }
}
const customer = async (request: APIRequestContext, phone: string) => (await call(request, 'GET', `/customers?phone=${phone}`)).body

test('a bill can add or change age/address but never blank them or rename the customer', async ({ request }) => {
  const phone = newPhone()
  await bill(request, phone, { name: 'Original Name', age: 40, address: '1 First St' })
  // A bill sent before the saved details had loaded: empty age and address, a different name.
  await bill(request, phone, { name: 'Typed Over', age: null, address: '' })
  let c = await customer(request, phone)
  expect([c.name, c.age, c.address]).toEqual(['Original Name', 40, '1 First St'])
  // A real change is taken.
  await bill(request, phone, { name: 'Original Name', age: 41, address: '2 Second St' })
  c = await customer(request, phone)
  expect([c.age, c.address]).toEqual([41, '2 Second St'])
})

test('PUT keeps the address when none is sent, clears it when sent empty, rejects a taken phone', async ({ request }) => {
  const phone = newPhone(), other = newPhone()
  await bill(request, phone, { name: 'Edit Me', age: 30, address: 'Keep Me' })
  await bill(request, other, { name: 'Other' })
  const c = await customer(request, phone)
  let r = await call(request, 'PUT', `/customers/${c.customer_id}`, { name: 'Edit Me 2', phone, age: 30 })
  expect(r.body.address).toBe('Keep Me')
  r = await call(request, 'PUT', `/customers/${c.customer_id}`, { name: 'Edit Me 2', phone, age: 30, address: '' })
  expect(r.body.address).toBeNull()
  r = await call(request, 'PUT', `/customers/${c.customer_id}`, { name: 'x', phone: other })
  expect(r.status).toBe(409)
})

test('edit the customer from an order; the printed bill and older bills show it', async ({ page, request }) => {
  const phone = newPhone()
  const first = await bill(request, phone, { name: 'Order Page Edit', age: 33, address: 'Old Address 1' })
  const second = await bill(request, phone, { name: 'Order Page Edit' })

  await page.goto(`/orders/${first.order_id}`)
  await expect(page.getByText('Old Address 1')).toBeVisible()
  await page.getByRole('button', { name: 'Edit' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Changes apply to all bills for this customer.')).toBeVisible()
  await dialog.getByRole('textbox').nth(0).fill('Renamed On Order')
  await dialog.locator('textarea').fill('New Address 9, Salt Lake')
  await page.screenshot({ path: 'screenshots/order-edit-customer.png' })
  await dialog.getByRole('button', { name: 'Save Changes' }).click()
  await expect(page.getByText('New Address 9, Salt Lake')).toBeVisible()
  await expect(page.getByText('Renamed On Order').first()).toBeVisible()

  // The other, older bill of this customer shows the same new details.
  await page.goto(`/orders/${second.order_id}`)
  await expect(page.getByText('New Address 9, Salt Lake')).toBeVisible()

  // The standalone print page carries the address.
  await page.goto(`/bill/${second.order_id}`)
  await expect(page.getByText('Customer Address')).toBeVisible()
  await expect(page.getByText('New Address 9, Salt Lake')).toBeVisible()
  await page.screenshot({ path: 'screenshots/bill-with-address.png' })
})

test('a bill without an address has no address row', async ({ page, request }) => {
  const b = await bill(request, newPhone(), { name: 'No Address' })
  await page.goto(`/bill/${b.order_id}`)
  await expect(page.getByText('Customer Name')).toBeVisible()
  await expect(page.getByText('Customer Address')).toHaveCount(0)
})

test('Customers page shows and edits the address', async ({ page, request }) => {
  const phone = newPhone()
  await bill(request, phone, { name: 'Listed Customer', address: 'Listed Road 5' })
  await page.goto('/customers')
  await page.locator('[data-search]').fill(phone)
  const row = page.locator('tbody tr').first()
  await expect(row.getByText('Listed Road 5')).toBeVisible()
  await row.getByRole('button').click()
  await expect(page.getByRole('dialog').locator('textarea')).toHaveValue('Listed Road 5')
})
