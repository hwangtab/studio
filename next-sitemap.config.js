/** @type {import('next-sitemap').IConfig} */
const siteUrl = process.env.SITE_URL || 'https://studionol.co.kr';

module.exports = {
  siteUrl,
  generateRobotsTxt: true,
  autoLastmod: false,
  changefreq: 'weekly',
  priority: 0.7,
  exclude: ['/api/*', '/404', '/500'],
  robotsTxtOptions: {
    policies: [
      { userAgent: '*', allow: '/' },
    ],
    additionalSitemaps: [],
  },
  // hreflang은 SEO 컴포넌트에서 HTML head로 처리됨
  // sitemap에서는 기본 URL만 제공
  transform: async (config, path) => {
    // 홈페이지 우선순위 높게
    if (path === '/' || path.match(/^\/[a-z]{2}$/)) {
      return {
        loc: path,
        changefreq: 'daily',
        priority: 1.0,
      }
    }
    // 스토리/포트폴리오 우선순위
    if (path.includes('/stories/') || path.includes('/portfolio/')) {
      return {
        loc: path,
        changefreq: 'weekly',
        priority: 0.8,
      }
    }
    return {
      loc: path,
      changefreq: config.changefreq,
      priority: config.priority,
    }
  },
}
