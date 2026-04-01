import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(160deg, #f2f7fc 0%, #ffffff 45%, #eef2ff 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 28,
              background: 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="72" height="72" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M15 28V12.5C15 11.7 15.7 11 16.5 11H21.7C25.6 11 28 13.1 28 16.4C28 19.7 25.6 21.9 21.7 21.9H18.5V28C18.5 28.8 17.8 29.5 17 29.5C16.2 29.5 15 28.8 15 28Z"
                fill="white"
                fillOpacity="0.98"
              />
              <path
                d="M18.5 14.2V19.1H21.4C23.6 19.1 24.8 17.9 24.8 16.6C24.8 15.3 23.6 14.2 21.4 14.2H18.5Z"
                fill="rgba(67,56,202,0.55)"
              />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 56, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em' }}>
              플래닉 Planic
            </div>
            <div style={{ fontSize: 28, color: '#475569', fontWeight: 500, maxWidth: 900, lineHeight: 1.35 }}>
              행사 문서를 하나씩 빠르게 만드는 AI 도구
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
