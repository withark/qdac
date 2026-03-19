import { ImageResponse } from 'next/og'

export const size = {
  width: 512,
  height: 512,
}

export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #6366F1 0%, #4338CA 100%)',
          borderRadius: 112,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 32,
            borderRadius: 96,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0) 60%)',
          }}
        />
        <div
          style={{
            position: 'relative',
            width: 280,
            height: 280,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="280" height="280" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M15 28V12.5C15 11.7 15.7 11 16.5 11H21.7C25.6 11 28 13.1 28 16.4C28 19.7 25.6 21.9 21.7 21.9H18.5V28C18.5 28.8 17.8 29.5 17 29.5C16.2 29.5 15 28.8 15 28Z"
              fill="white"
              fillOpacity="0.98"
            />
            <path d="M18.5 14.2V19.1H21.4C23.6 19.1 24.8 17.9 24.8 16.6C24.8 15.3 23.6 14.2 21.4 14.2H18.5Z" fill="rgba(67,56,202,0.55)" />
          </svg>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}

