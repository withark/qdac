import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function getUserIdFromSession(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  const id = session?.user?.id
  return typeof id === 'string' && id.trim() ? id : null
}

