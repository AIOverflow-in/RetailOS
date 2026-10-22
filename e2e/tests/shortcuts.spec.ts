import { test, expect } from '@playwright/test'

const btn = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Keyboard shortcuts' })

test('Alt+digit jumps between pages, Alt+N starts a bill', async ({ page }) => {
  await page.goto('/dashboard')
  await page.keyboard.press('Alt+Digit3'); await expect(page).toHaveURL(/\/inventory/)
  await page.keyboard.press('Alt+Digit5'); await expect(page).toHaveURL(/\/orders/)
  await page.keyboard.press('Alt+Digit6'); await expect(page).toHaveURL(/\/customers/)
  await page.keyboard.press('Alt+KeyN'); await expect(page).toHaveURL(/\/billing/)
  await expect(page.locator('tr[data-row] [data-field="product"]').first()).toBeFocused()
})

test('/ focuses the page search, but not while typing', async ({ page }) => {
  for (const p of ['orders', 'inventory', 'customers']) {
    await page.goto('/' + p)
    await page.waitForLoadState('networkidle')
    await page.locator('body').click({ position: { x: 5, y: 5 } })
    await page.keyboard.press('/')
    await expect(page.locator('[data-search]')).toBeFocused()
    await page.keyboard.type('a/b')
    await expect(page.locator('[data-search]')).toHaveValue('a/b')
  }
})

test('? and hover show the panel; Esc closes the pinned one', async ({ page }) => {
  await page.goto('/billing')
  await page.waitForLoadState('networkidle')
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('Shift+/')
  await expect(page.getByText('Place order', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'screenshots/shortcut-panel.png' })
  await page.keyboard.press('Escape')
  await expect(page.getByText('Place order', { exact: true })).toBeHidden()
  await btn(page).hover()
  await expect(page.getByText('Place order', { exact: true })).toBeVisible()
})

test('button: clear of Sign out, draggable, remembered, never off-screen', async ({ page }) => {
  await page.goto('/billing')
  const b = (await btn(page).boundingBox())!
  const signOut = (await page.getByText('Sign out').boundingBox())!
  const overlaps = b.x < signOut.x + signOut.width && b.x + b.width > signOut.x && b.y < signOut.y + signOut.height && b.y + b.height > signOut.y
  expect(overlaps, 'overlaps the Sign out row').toBe(false)

  await page.mouse.move(b.x + 20, b.y + 20); await page.mouse.down()
  await page.mouse.move(b.x + 420, b.y - 200, { steps: 8 }); await page.mouse.up()
  const moved = (await btn(page).boundingBox())!
  expect(Math.round(moved.x - b.x)).toBeGreaterThan(300)
  await page.reload()
  const after = (await btn(page).boundingBox())!
  expect(Math.abs(after.x - moved.x)).toBeLessThan(2)

  // A position saved on a bigger window must not strand it off-screen.
  await page.evaluate(() => localStorage.setItem('shortcuts_pos', JSON.stringify({ left: 9000, bottom: 9000 })))
  await page.reload()
  const clamped = (await btn(page).boundingBox())!
  const vp = page.viewportSize()!
  expect(clamped.x + clamped.width).toBeLessThanOrEqual(vp.width)
  expect(clamped.y).toBeGreaterThanOrEqual(0)
  await page.evaluate(() => localStorage.removeItem('shortcuts_pos'))
})
