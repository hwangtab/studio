const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');

const fundingDir = path.join(process.cwd(), 'content', 'funding');

// 앱(lib/funding/projects.ts)이 프로젝트 공개 여부를 판정할 때 쓰는 status 값. 두 곳이
// 어긋나면 "앱은 404인데 사이트맵·IndexNow는 그 URL을 제출"하는 상태가 된다.
const FUNDING_STATUSES = ['auto', 'draft', 'closed'];

// YAML은 `lastmod: 2026-09-09`를 Date로 파싱한다(js-yaml timestamp). 문자열로 따옴표를
// 씌워 적었을 때도 같은 결과가 나오도록 양쪽을 받는다. projects.ts의 lastmod 처리와 동일.
const toLastmod = (value) => {
  if (value instanceof Date) return `${value.toISOString().slice(0, 10)}T00:00:00+09:00`;
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? `${m[1]}T00:00:00+09:00` : null;
  }
  return null;
};

/**
 * content/funding/*.md frontmatter를 읽어 draft·hidden·lastmod을 반환한다.
 * next-sitemap.config.js(등재 필터: draft·hidden 프로젝트 제외)와 lib/sitemap/routes.js
 * (lastmod)가 각자 fs.readFileSync + 정규식으로 같은 파일을 중복 파싱하던 것을 하나로 합친다.
 *
 * 파싱은 앱과 **같은 파서**(gray-matter)로 한다. 예전엔 정규식 `/^status:\s*draft/m`으로
 * 읽어서, 같은 frontmatter를 앱과 사이트맵이 서로 다르게 판정할 수 있었다 —
 * `status: "draft"`(따옴표)는 정규식에 안 잡혀 사이트맵이 초안 URL을 제출하고,
 * 본문 코드블록 안의 `hidden: true` 한 줄은 잡혀서 공개 프로젝트가 사이트맵에서 빠졌다.
 * 판정 규칙(draft·hidden)도 projects.ts와 같은 값으로 맞춰 둔다.
 */
const readFundingProjects = () => {
  if (!fs.existsSync(fundingDir)) return [];
  return fs.readdirSync(fundingDir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const slug = file.replace(/\.md$/, '');
      const { data } = matter(fs.readFileSync(path.join(fundingDir, file), 'utf-8'));
      const status = data.status === undefined || data.status === null ? 'auto' : data.status;
      if (typeof status !== 'string' || !FUNDING_STATUSES.includes(status)) {
        throw new Error(`funding frontmatter(${file}): status은(는) ${FUNDING_STATUSES.join(' | ')} 중 하나여야 합니다 (받은 값: ${JSON.stringify(data.status)})`);
      }
      if (data.hidden !== undefined && data.hidden !== null && typeof data.hidden !== 'boolean') {
        throw new Error(`funding frontmatter(${file}): hidden은(는) boolean(true | false)이어야 합니다 — 따옴표가 붙은 "true"는 문자열이라 거부합니다 (받은 값: ${JSON.stringify(data.hidden)})`);
      }
      return { slug, draft: status === 'draft', hidden: data.hidden === true, lastmod: toLastmod(data.lastmod) };
    });
};

module.exports = { fundingDir, FUNDING_STATUSES, readFundingProjects };
