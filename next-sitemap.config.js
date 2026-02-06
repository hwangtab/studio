module.exports = {
  siteUrl: process.env.SITE_URL || 'https://studionol.co.kr',
  generateRobotsTxt: true,
  alternateRefs: [
    { href: 'https://studionol.co.kr/ko', hreflang: 'ko' },
    { href: 'https://studionol.co.kr/en', hreflang: 'en' },
    { href: 'https://studionol.co.kr/zh', hreflang: 'zh' },
    { href: 'https://studionol.co.kr/es', hreflang: 'es' },
    { href: 'https://studionol.co.kr/vi', hreflang: 'vi' },
    { href: 'https://studionol.co.kr/th', hreflang: 'th' },
    { href: 'https://studionol.co.kr/uz', hreflang: 'uz' },
  ],
  exclude: [
    '/api/*',
    '/',
    '/about',
// ... rest of the file

