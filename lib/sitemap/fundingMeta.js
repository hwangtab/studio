const fs = require('node:fs');
const path = require('node:path');

const fundingDir = path.join(process.cwd(), 'content', 'funding');

// content/funding/*.md frontmatter를 정규식으로 읽어 draft·hidden·lastmod을 반환한다.
// next-sitemap.config.js(등재 필터: draft·hidden 프로젝트 제외)와 lib/sitemap/routes.js
// (lastmod)가 각자 fs.readFileSync + 정규식으로 같은 파일을 중복 파싱하던 것을 하나로 합친다.
const readFundingProjects = () => {
  if (!fs.existsSync(fundingDir)) return [];
  return fs.readdirSync(fundingDir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const raw = fs.readFileSync(path.join(fundingDir, file), 'utf-8');
      const slug = file.replace(/\.md$/, '');
      const draft = /^status:\s*draft/m.test(raw);
      const hidden = /^hidden:\s*true/m.test(raw);
      const m = raw.match(/^lastmod:\s*(\d{4}-\d{2}-\d{2})/m);
      const lastmod = m ? `${m[1]}T00:00:00+09:00` : null;
      return { slug, draft, hidden, lastmod };
    });
};

module.exports = { fundingDir, readFundingProjects };
