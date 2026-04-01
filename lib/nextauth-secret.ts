export function resolveNextAuthSecret(): string {
  const s = (process.env.NEXTAUTH_SECRET ?? '').trim()
  if (s) return s
  throw new Error('NEXTAUTH_SECRET가 설정되지 않았습니다. 인증 기능을 사용하려면 환경변수를 설정하세요.')
}

