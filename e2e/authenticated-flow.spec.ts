import { expect, test, type Page } from '@playwright/test'

async function signInWithDevAuth(page: Page, callbackUrl: string) {
  const uniqueEmail = `playwright+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@local`
  const csrf = await page.context().request.get('/api/auth/csrf')
  const { csrfToken } = (await csrf.json()) as { csrfToken: string }

  const signIn = await page.context().request.post('/api/auth/callback/dev-login', {
    form: {
      csrfToken,
      email: uniqueEmail,
      secret: 'playwright-secret',
      callbackUrl,
      json: 'true',
    },
  })

  expect(signIn.ok()).toBeTruthy()
}

async function authenticateFromProtectedRoute(page: Page, protectedPath: string) {
  await page.goto(protectedPath)
  await expect(page).toHaveURL(/\/auth\?/)
  await expect(page.getByRole('heading', { name: '회원가입' })).toBeVisible()

  await signInWithDevAuth(page, protectedPath)
  await page.goto(protectedPath)
  await expect(page).toHaveURL(new RegExp(`${protectedPath.replace('/', '\\/')}($|\\?)`))
}

test.describe('authenticated generation flow', () => {
  test('protected estimate route returns after auth', async ({ page }) => {
    await authenticateFromProtectedRoute(page, '/estimate-generator')
    await expect(page.getByRole('heading', { name: '견적서 만들기' })).toBeVisible()
    await expect(page.getByRole('button', { name: '견적 생성' })).toBeVisible()
  })

  test('signed-in user can generate estimate and download excel', async ({ page }) => {
    await authenticateFromProtectedRoute(page, '/estimate-generator')

    await page.getByLabel('이벤트 주제').fill('Playwright 기업 워크숍')
    await page.getByLabel('참석 인원(선택)').fill('80')
    await page.getByLabel('장소(선택)').fill('잠실')
    await page.getByLabel('추가 메모(선택)').fill('VIP 좌석 포함, 네트워킹 세션 필요')
    await page.getByRole('button', { name: '견적 생성' }).click()

    await expect(page.getByText('견적 결과')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: '엑셀 다운로드' })).toBeVisible()

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: '엑셀 다운로드' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/)

    await expect(page.getByText('엑셀 다운로드 완료!')).toBeVisible()
  })
})
