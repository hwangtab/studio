const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const storiesDir = path.join(__dirname, '../content/stories');
const outputFile = path.join(__dirname, '../public/data/stories.json');

const generateStories = () => {
  const files = fs.readdirSync(storiesDir);
  const stories = files
    .filter(file => file.endsWith('.md'))
    .map(file => {
      const rawContent = fs.readFileSync(path.join(storiesDir, file), 'utf8');
      // 마크다운 코드 블록 완전 제거
      const content = rawContent
        .replace(/^```markdown\n/, '')
        .replace(/\n```$/, '')
        .trim();
      
      const { data, content: body } = matter(content);
      const cleanContent = body
        .replace(/^---[\s\S]*?---/, '') // 남아있는 frontmatter 제거
        // 마크다운 헤더 정규화 (## → ###)
        .replace(/^##\s+(.*$)/gm, '### $1')
        .trim();
      
      return {
        id: path.parse(file).name,
        title: data.title || path.parse(file).name,
        date: data.date || new Date().toISOString(),
        author: data.author || '스튜디오 놀',
        category: data.category || '공지',
        tags: Array.isArray(data.tags) ? data.tags : ['기본'],
        content: cleanContent,
        summary: cleanContent.replace(/\n/g, ' ').substring(0, 100) + (cleanContent.length > 100 ? '...' : '')
      };
    });
  fs.writeFileSync(outputFile, JSON.stringify(stories, null, 2));
  console.log(`Generated ${stories.length} stories to ${outputFile}`);
};

generateStories();