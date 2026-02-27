import type { MetadataRoute } from "next"

const BASE_URL = "https://musicana.vercel.app"

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    {
      url:              `${BASE_URL}/`,
      lastModified:     now,
      changeFrequency:  "daily",
      priority:         1.0,
    },
    {
      url:              `${BASE_URL}/moods`,
      lastModified:     now,
      changeFrequency:  "weekly",
      priority:         0.8,
    },
    {
      url:              `${BASE_URL}/library`,
      lastModified:     now,
      changeFrequency:  "weekly",
      priority:         0.8,
    },
    {
      url:              `${BASE_URL}/history`,
      lastModified:     now,
      changeFrequency:  "weekly",
      priority:         0.7,
    },
    {
      url:              `${BASE_URL}/settings`,
      lastModified:     now,
      changeFrequency:  "monthly",
      priority:         0.4,
    },
    {
      url:              `${BASE_URL}/about`,
      lastModified:     now,
      changeFrequency:  "monthly",
      priority:         0.5,
    },
  ]

  return staticPages
}
