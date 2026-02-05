module.exports = {
  siteUrl: process.env.SITE_URL || 'https://studionol.co.kr',
  generateRobotsTxt: true,
  exclude: [
    '/api/*',
    '/',
    '/about',
    '/contact',
    '/lesson',
    '/portfolio',
    '/practice-room',
    '/pricing',
    '/stories',
    '/studio-info',
    '/portfolio/*',
    '/stories/*',
  ],
  outDir: 'out',
};
