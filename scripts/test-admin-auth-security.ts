import { verifyAdmin } from '@/lib/admin-auth'

type Snapshot = {
  NODE_ENV?: string
  ADMIN_PASSWORD?: string
  DATABASE_URL?: string
}

function takeEnvSnapshot(): Snapshot {
  return {
    NODE_ENV: process.env.NODE_ENV,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    DATABASE_URL: process.env.DATABASE_URL,
  }
}

function restoreEnv(snapshot: Snapshot): void {
  const env = process.env as Record<string, string | undefined>
  if (snapshot.NODE_ENV === undefined) delete env.NODE_ENV
  else env.NODE_ENV = snapshot.NODE_ENV
  if (snapshot.ADMIN_PASSWORD === undefined) delete env.ADMIN_PASSWORD
  else env.ADMIN_PASSWORD = snapshot.ADMIN_PASSWORD
  if (snapshot.DATABASE_URL === undefined) delete env.DATABASE_URL
  else env.DATABASE_URL = snapshot.DATABASE_URL
}

function must(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function main() {
  const snapshot = takeEnvSnapshot()
  try {
    const env = process.env as Record<string, string | undefined>
    delete env.DATABASE_URL
    env.NODE_ENV = 'production'

    env.ADMIN_PASSWORD = 'admin'
    const weakRejected = await verifyAdmin('admin', 'admin')
    must(!weakRejected, 'production에서 약한 ADMIN_PASSWORD(admin)로 로그인되면 안 됩니다.')

    env.ADMIN_PASSWORD = 'StrongAdmin!2026'
    const strongAccepted = await verifyAdmin('admin', 'StrongAdmin!2026')
    must(strongAccepted, 'production에서 강한 ADMIN_PASSWORD로 로그인되어야 합니다.')

    env.ADMIN_PASSWORD = 'StrongAdmin!2026'
    const wrongPasswordRejected = await verifyAdmin('admin', 'wrong-password')
    must(!wrongPasswordRejected, '잘못된 관리자 비밀번호는 거절되어야 합니다.')

    console.log('test:admin-auth-security passed')
  } finally {
    restoreEnv(snapshot)
  }
}

main().catch((error) => {
  const msg = error instanceof Error ? error.message : String(error)
  console.error(`test:admin-auth-security failed: ${msg}`)
  process.exit(1)
})
