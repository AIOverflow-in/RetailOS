import { test, expect } from '@playwright/test'
import { failOnConsoleErrors, productBox } from './helpers'

// Runs at desktop AND phone width (see playwright.config.ts): nothing may spill off the screen.
test('billing footer stays on screen', async ({ page }, info) => {
  await page.goto('/billing')
  await expect(productBox(page)).toBeVisible()
  const vw = page.viewportSize()!.width
  for (const el of [page.getByRole('button', { name: /Place Order/ }), page.getByText(/Required:/)]) {
    const b = (await el.boundingBox())!
    expect(b.x, 'left edge on screen').toBeGreaterThanOrEqual(0)
    expect(b.x + b.width, 'right edge on screen').toBeLessThanOrEqual(vw)
  }
  await page.screenshot({ path: `screenshots/layout-billing-${info.project.name}.png` })
})

for (const path of ['dashboard', 'billing', 'inventory', 'distributors', 'orders', 'customers', 'reports', 'settings']) {
  test(`${path}: no page-wide sideways scroll and no console errors`, async ({ page }, info) => {
    const check = failOnConsoleErrors(page)
    await page.goto('/' + path)
    await page.waitForLoadState('networkidle')
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(over, 'horizontal overflow in px').toBeLessThanOrEqual(1)
    await page.screenshot({ path: `screenshots/page-${path}-${info.project.name}.png` })
    check()
  })
}
