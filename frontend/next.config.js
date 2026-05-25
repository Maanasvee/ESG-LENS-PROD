/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow iframe embedding from Bevolve.ai as requested
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://bevolve.ai https://*.bevolve.ai localhost:*;"
          }
        ]
      }
    ]
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true } // Handled separately
}

module.exports = nextConfig
