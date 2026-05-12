import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/home', '/privacy', '/terms'],
        disallow: [
          '/sign-in',
          '/sign-up',
          '/dashboard',
          '/gas-planner',
          '/documents',
          '/assistant',
          '/admin/',
          '/settings/',
          '/billing/',
          '/api/',
        ],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL || 'https://template.kosuke.ai'}/sitemap.xml`,
  };
}
