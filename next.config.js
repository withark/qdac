/** @type {import('next').NextConfig} */
// NEXTAUTH_URL이 빈 값이면 빌드 시 Invalid URL 오류 발생 → placeholder 설정
const url = process.env.NEXTAUTH_URL?.trim()
if (!url || !url.startsWith('http')) {
  process.env.NEXTAUTH_URL = 'https://placeholder.build'
}

const nextConfig = {}

module.exports = nextConfig
