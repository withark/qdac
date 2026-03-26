import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { isEmailPasswordAuthEnabled } from '@/lib/auth-email-password'
import { createCredentialUser } from '@/lib/db/users-db'

const schema = z.object({
  login: z.string().min(1).max(200),
  password: z.string().min(6).max(200),
  name: z.string().max(100).optional(),
})

export async function POST(request: Request) {
  if (!isEmailPasswordAuthEnabled()) {
    return NextResponse.json({ error: 'disabled' }, { status: 403 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation_failed' }, { status: 400 })
  }
  const { login, password, name } = parsed.data
  try {
    const hash = await bcrypt.hash(password, 10)
    const user = await createCredentialUser({ login, passwordHash: hash, name })
    return NextResponse.json({ ok: true, email: user.email })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'duplicate_email') {
      return NextResponse.json({ error: 'duplicate' }, { status: 409 })
    }
    console.error('[register]', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
