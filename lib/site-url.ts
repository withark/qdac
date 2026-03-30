/**
 * SEO·sitemap·JSON-LD용 절대 URL 베이스.
 * NEXTAUTH_URL이 없으면 Vercel 프리뷰/배포 호스트 또는 로컬 기본값을 사용합니다.
 */
function normalizeAbsoluteUrl(raw: string | undefined | null): string | null {
  const value = (raw || '').trim().replace(/\/$/, '')
  if (!value.startsWith('http://') && !value.startsWith('https://')) return null
  if (value.includes('placeholder.build')) return null
  return value
}

export function getSiteUrl(): string {
  const nextAuthUrl = normalizeAbsoluteUrl(process.env.NEXTAUTH_URL)
  if (nextAuthUrl) return nextAuthUrl
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) {
    return `https://${vercel.replace(/\/$/, '')}`
  }
  return 'http://localhost:3000'
}

export function getMetadataBase(): URL {
  return new URL(getSiteUrl())
}
