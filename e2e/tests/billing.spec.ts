import { test, expect } from '@playwright/test'
import { call, closePrintTabs, failOnConsoleErrors, newPhone, pickProduct, pickProducts, productBox, qtyBox } from './helpers'

test.describe('billing by keyboard', () => {
  test('cursor starts in the first product box, no console errors', async ({ page }) => {
    const check = failOnConsoleErrors(page)
    await page.goto('/billing')
    await expect(productBox(page)).toBeFocused()
    await page.screenshot({ path: 'screenshots/billing-start.png' })
    check()
  })

  test('product → Qty → next line → phone → Ctrl+Enter places one bill', async ({ page, request }) => {
    closePrintTabs(page)
    const { single } = await pickProducts(request)
    const phone = newPhone()
    await page.goto('/billing')
    await pickProduct(page, single.name)
    await expect(qtyBox(page)).toBeFocused()
    // The quantity is selected, so typing replaces it.
    await page.keyboard.type('2')
    await expect(qtyBox(page)).toHaveValue('2')
    await page.keyboard.press('Enter')
    await expect(productBox(page, 1)).toBeFocused()

    await page.keyboard.press('F2')
    await expect(page.locator('[data-field="phone"]')).toBeFocused()
    await page.keyboard.type(phone)
    await page.getByPlaceholder('Patient name').fill('E2E Walk In')
    await page.getByPlaceholder('Optional').fill('7 Test Lane, Kolkata')
    // The saved-customer lookup must have finished before the bill can go.
    await expect(page.getByText('Ctrl + Enter to place order')).toBeVisible()
    await page.screenshot({ path: 'screenshots/billing-ready.png' })

    // Holding the keys down repeats Enter: still exactly one bill.
    await page.keyboard.down('Control')
    await page.keyboard.down('Enter'); await page.keyboard.down('Enter'); await page.keyboard.down('Enter')
    await page.keyboard.up('Enter'); await page.keyboard.up('Control')
    await expect(page.getByText(/Bill created/)).toBeVisible()

    // Fresh bill, cursor back in the first product box.
    await expect(productBox(page), await page.evaluate(() => { const a = document.activeElement as HTMLElement; return `active: ${a.tagName} ${a.dataset?.field ?? ''} ${(a as HTMLInputElement).placeholder ?? ''}` })).toBeFocused()
    await expect(productBox(page)).toHaveValue('')

    const c = (await call(request, 'GET', `/customers?phone=${phone}`)).body
    expect(c.address).toBe('7 Test Lane, Kolkata')
    const orders = (await call(request, 'GET', `/orders?q=${phone}`)).body
    const list = orders.orders ?? orders
    expect(list.length, 'exactly one bill for this customer').toBe(1)
  })

  test('a product with several batches stops at the Batch box', async ({ page, request }) => {
    const { multi } = await pickProducts(request)
    test.skip(!multi, 'no product with 2+ sellable batches in the data')
    await page.goto('/billing')
    await pickProduct(page, multi![0].name)
    const batch = page.locator('tr[data-row] [data-field="batch"]').first()
    await expect(batch).toBeFocused()
    await batch.selectOption({ index: 1 })
    await page.keyboard.press('Enter')
    await expect(qtyBox(page)).toBeFocused()
  })

  test('Alt+D deletes the line and focus moves up', async ({ page, request }) => {
    const { single } = await pickProducts(request)
    await page.goto('/billing')
    await pickProduct(page, single.name)
    await expect(qtyBox(page)).toBeFocused()
    await page.keyboard.press('Enter') // Qty → new line
    await expect(productBox(page, 1)).toBeFocused()
    await page.keyboard.press('Alt+KeyD')
    await expect(page.locator('tr[data-row]')).toHaveCount(1)
    await expect(productBox(page, 0)).toBeFocused()
  })

  test('Place Order never moves, whatever the hint says', async ({ page, request }) => {
    const { single } = await pickProducts(request)
    await page.goto('/billing')
    const btn = page.getByRole('button', { name: /Place Order/ })
    const pos = async () => { const b = (await btn.boundingBox())!; return [Math.round(b.x), Math.round(b.y)] }
    const first = await pos()
    await page.keyboard.press('F2'); await page.keyboard.type('98765')
    expect(await pos()).toEqual(first)
    await page.getByPlaceholder('Patient name').fill('X')
    expect(await pos()).toEqual(first)
    await pickProduct(page, single.name)
    await expect(qtyBox(page)).toBeFocused()
    // A row can grow (e.g. a GST warning), so only the sideways position is fixed here.
    // (a vertical scrollbar appearing can shift the page by a few px)
    expect(Math.abs((await pos())[0] - first[0]), 'after adding an item (summary and Clear appear)').toBeLessThanOrEqual(16)
    await page.screenshot({ path: 'screenshots/billing-with-item.png' })
  })

  test('returning customer: details fill in and the name is locked', async ({ page, request }) => {
    const phone = newPhone()
    const { single } = await pickProducts(request)
    await call(request, 'POST', '/orders', {
      client_ref: crypto.randomUUID(), is_in_state: true, payment_mode: 'cash', phone, name: 'Saved Name', age: 41, address: '1 Old Road',
      items: [{ batch_id: single.batch_id, product_name: single.name, batch_no: single.batch_no, qty: 1, sale_price: Number(single.selling_price), gst_rate: 0 }],
    })
    await page.goto('/billing')
    await page.keyboard.press('F2'); await page.keyboard.type(phone)
    const name = page.getByPlaceholder('Patient name')
    await expect(name).toHaveValue('Saved Name')
    await expect(name).toHaveAttribute('readonly', '')
    await expect(page.getByPlaceholder('Optional')).toHaveValue('1 Old Road')
    await page.screenshot({ path: 'screenshots/billing-returning-customer.png' })
  })
})
