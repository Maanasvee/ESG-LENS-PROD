/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow embedding in iframe from bevolve.ai
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOW-FROM https://bevolve.ai',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://bevolve.ai https://*.bevolve.ai;",
          },
        ],
      },
    ]
  },

  // Proxy API calls to backend in development
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ]
  },

  // Optimize images
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.googleusercontent.com' },
    ],
  },

  // Transpile firebase for SSR compatibility
  transpilePackages: [],
}

module.exports = nextConfig
