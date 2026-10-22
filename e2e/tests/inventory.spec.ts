import { test, expect } from '@playwright/test'
import { failOnConsoleErrors } from './helpers'

const rows = (page: import('@playwright/test').Page) => page.locator('table tbody tr')
const stockOf = async (page: import('@playwright/test').Page) => (await rows(page).locator('td:nth-child(7)').allInnerTexts()).map(t => Number(t.trim()))

test('no HSN column; zero stock hidden by default and says so', async ({ page }) => {
  const check = failOnConsoleErrors(page)
  await page.goto('/inventory')
  await expect(rows(page).first()).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'HSN' })).toHaveCount(0)
  await expect(page.getByLabel('Hide out of stock')).toBeChecked()
  await expect(page.getByText('Out-of-stock batches are hidden.')).toBeVisible()
  expect(Math.min(...(await stockOf(page)))).toBeGreaterThan(0)
  await page.screenshot({ path: 'screenshots/inventory-default.png' })

  await page.getByText('Show them').click()
  await expect(page.getByLabel('Hide out of stock')).not.toBeChecked()
  await expect(page.getByText('Out-of-stock batches are hidden.')).toBeHidden()
  await page.getByLabel('Hide expired').uncheck()
  await page.getByRole('combobox').selectOption('stock')
  expect(Math.min(...(await stockOf(page)))).toBe(0)
  check()
})

test('unchecking Hide expired shows expired batches even with zero stock hidden', async ({ page }) => {
  await page.goto('/inventory')
  await expect(rows(page).first()).toBeVisible()
  const count = async () => Number((await page.getByText(/Showing \d+ of/).innerText()).match(/Showing (\d+)/)![1])
  const before = await count()
  await page.getByLabel('Hide expired').uncheck()
  await expect.poll(count).toBeGreaterThan(before)
})

for (const width of [1366, 1280]) test(`Add batch and the actions menu are reachable without scrolling sideways at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 800 })
  await page.goto('/inventory')
  await expect(rows(page).first()).toBeVisible()
  const vw = width
  const over = await page.evaluate(() => { const w = document.querySelector('table')!.parentElement!; return w.scrollWidth - w.clientWidth })
  expect(over, 'the table needs no sideways scrolling').toBeLessThanOrEqual(1)
  await page.screenshot({ path: `screenshots/inventory-${width}.png` })
  for (let i = 0; i < 5; i++) {
    const add = (await rows(page).nth(i).getByRole('button', { name: 'Add batch' }).boundingBox())!
    const more = (await rows(page).nth(i).getByRole('button', { name: 'More actions' }).boundingBox())!
    expect(add.x + add.width, `row ${i} Add batch`).toBeLessThanOrEqual(vw)
    expect(more.x + more.width, `row ${i} menu`).toBeLessThanOrEqual(vw)
  }
  const more = rows(page).first().getByRole('button', { name: 'More actions' })
  await more.hover()
  await expect(page.getByRole('menuitem', { name: 'Edit batch' })).toBeVisible()
  await page.getByRole('menuitem', { name: 'Edit batch' }).hover() // moving onto the menu keeps it open
  await expect(page.getByRole('menuitem', { name: 'Adjust stock' })).toBeVisible()
  await page.screenshot({ path: 'screenshots/inventory-menu.png' })
  await page.getByRole('menuitem', { name: 'Edit product' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})
