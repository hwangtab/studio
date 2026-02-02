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

  // Map environment variables to client-side (to avoid renaming in Vercel)
  env: {
    NEXT_PUBLIC_EMAILJS_SERVICE_ID: process.env.EMAILJS_SERVICE_ID,
    NEXT_PUBLIC_EMAILJS_TEMPLATE_ID: process.env.EMAILJS_TEMPLATE_ID,
    NEXT_PUBLIC_EMAILJS_PUBLIC_KEY: process.env.EMAILJS_PUBLIC_KEY,
  },

  // Headers configuration removed as it is incompatible with output: 'export'
};

export default nextConfig;
