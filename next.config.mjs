const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  compress: true,
  // output: 'export',

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
      {
        protocol: 'https',
        hostname: 'www.news-art.co.kr',
      },
    ],
    minimumCacheTTL: 31536000, // 1 year for external images
    formats: ['image/avif', 'image/webp'],
  },

  // Experimental optimizations
  experimental: {
    optimizePackageImports: ['lucide-react', 'react-icons', 'react-icons/fa'],
  },

  // Headers configuration removed as it is incompatible with output: 'export'
};

export default nextConfig;
