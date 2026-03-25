/**
 * SEO·sitemap·JSON-LD용 절대 URL 베이스.
 * NEXTAUTH_URL이 없으면 Vercel 프리뷰/배포 호스트 또는 로컬 기본값을 사용합니다.
 */
export function getSiteUrl(): string {
  const raw = process.env.NEXTAUTH_URL?.trim() ?? ''
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw.replace(/\/$/, '')
  }
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) {
    return `https://${vercel.replace(/\/$/, '')}`
  }
  return 'http://localhost:3000'
}
