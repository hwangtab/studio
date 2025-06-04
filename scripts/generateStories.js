const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const marked = require('marked');

// 디렉토리 생성 함수
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// 스토리 마크다운 파일 처리
const generateStories = () => {
  const storiesDir = path.join(__dirname, '../content/stories');
  const outputFile = path.join(__dirname, '../public/data/stories.json');
  
  ensureDirectoryExists(path.dirname(outputFile));

  const storyFiles = fs.readdirSync(storiesDir)
    .filter(file => file.endsWith('.md'));

  const stories = storyFiles.map(file => {
    const filePath = path.join(storiesDir, file);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const { data: frontmatter, content } = matter(fileContent);
    
    return {
      id: path.parse(file).name,
      ...frontmatter,
      content: marked.parse(content),
      date: new Date(frontmatter.date).toISOString(),
      image: frontmatter.image || null
    };
  });

  // 날짜 기준으로 최신순 정렬
  stories.sort((a, b) => new Date(b.date) - new Date(a.date));

  fs.writeFileSync(outputFile, JSON.stringify(stories, null, 2));
  console.log(`Generated ${stories.length} stories to ${outputFile}`);
};

generateStories();