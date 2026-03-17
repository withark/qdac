export function tossBasicAuthHeader(secretKey: string): string {
  const token = Buffer.from(`${secretKey}:`, 'utf8').toString('base64')
  return `Basic ${token}`
}

