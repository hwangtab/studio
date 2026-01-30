const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  compress: true,
  output: 'export',

  // Optimized image configuration
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.bugsm.co.kr',
      },
      {
        protocol: 'https',
        hostname: 'img.tumblbug.com',
      },
      {
        protocol: 'https',
        hostname: 'is1-ssl.mzstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'thumb.mt.co.kr',
      },
      {
        protocol: 'https',
        hostname: 'cdn.imweb.me',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
    ],
    minimumCacheTTL: 31536000, // 1 year for external images
    formats: ['image/avif', 'image/webp'],
  },

  // Experimental optimizations
  experimental: {
    optimizePackageImports: ['lucide-react', 'react-icons', 'react-icons/fa'],
  },

  // Headers for caching and security
  async headers() {
    return [
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
