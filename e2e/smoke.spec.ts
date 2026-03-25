import { test, expect } from '@playwright/test'

test.describe('public marketing', () => {
  test('home loads with main heading', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('features page loads', async ({ page }) => {
    await page.goto('/features')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/기능/)
  })

  test('help page FAQ opens from hash', async ({ page }) => {
    await page.goto('/help#faq-document-types')
    await expect(page.getByRole('button', { name: /어떤 문서를 만들 수 있나요/ })).toHaveAttribute('aria-expanded', 'true')
  })

  test('plans page shows comparison table', async ({ page }) => {
    await page.goto('/plans')
    await expect(page.getByRole('heading', { name: '플랜 핵심 비교' })).toBeVisible()
    await expect(page.getByRole('table', { name: '무료, 베이직, 프리미엄 플랜 비교' })).toBeVisible()
  })

  test('terms page loads', async ({ page }) => {
    await page.goto('/terms')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
})
