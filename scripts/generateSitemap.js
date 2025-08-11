const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const storiesDirectory = path.join(__dirname, '../content/stories');
const publicDirectory = path.join(__dirname, '../public');
const sitemapPath = path.join(publicDirectory, 'sitemap.xml');

const baseUrl = 'https://studionol.co.kr'; // From package.json homepage

async function generateSitemap() {
  const storyFiles = fs.readdirSync(storiesDirectory).filter(file => file.endsWith('.md'));

  let urls = [];

  // Add static pages
  urls.push({ loc: baseUrl + '/', changefreq: 'weekly', priority: '1.0' });
  urls.push({ loc: baseUrl + '/portfolio', changefreq: 'monthly', priority: '0.8' });
  urls.push({ loc: baseUrl + '/studio-info', changefreq: 'monthly', priority: '0.8' });
  urls.push({ loc: baseUrl + '/practice-room', changefreq: 'monthly', priority: '0.8' });
  urls.push({ loc: baseUrl + '/contact', changefreq: 'monthly', priority: '0.8' });
  urls.push({ loc: baseUrl + '/about', changefreq: 'monthly', priority: '0.7' });
  urls.push({ loc: baseUrl + '/stories', changefreq: 'weekly', priority: '0.8' });

  for (const file of storyFiles) {
    const filePath = path.join(storiesDirectory, file);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const { data } = matter(fileContent);

    const storyId = file.replace('.md', ''); // Assuming filename is the ID
    const lastmod = data.date ? new Date(data.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    urls.push({
      loc: `${baseUrl}/stories/${storyId}`,
      lastmod: lastmod,
      changefreq: 'monthly',
      priority: '0.9'
    });
  }

  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod || ''}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  fs.writeFileSync(sitemapPath, sitemapContent);
  console.log('Sitemap generated successfully!');
}

generateSitemap();