import { chromium } from '@playwright/test'

// Log in once through the real login page; every test reuses the saved session.
export default async function globalSetup() {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto('http://localhost:3000/login')
  await page.locator('input').first().fill('testshop')
  await page.locator('input[type="password"]').fill('test123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/dashboard|billing/, { timeout: 30_000 })
  await page.context().storageState({ path: '.auth.json' })
  await browser.close()
}
