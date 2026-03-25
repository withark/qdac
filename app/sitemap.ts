import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site-url'

const PUBLIC_PATHS: { path: string; changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency']; priority: number }[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/features', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/guide', changeFrequency: 'weekly', priority: 0.85 },
  { path: '/help', changeFrequency: 'weekly', priority: 0.85 },
  { path: '/plans', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.4 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.4 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl()
  const now = new Date()
  return PUBLIC_PATHS.map(({ path, changeFrequency, priority }) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }))
}
