const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const storiesDir = path.join(__dirname, '../content/stories');
const outputFile = path.join(__dirname, '../public/data/stories.json');

const generateStories = () => {
  try {
    const files = fs.readdirSync(storiesDir);
    const stories = files
      .filter(file => file.endsWith('.md'))
      .map(file => {
        try {
          const rawContent = fs.readFileSync(path.join(storiesDir, file), 'utf8');
          // 마크다운 코드 블록 완전 제거
          const content = rawContent
            .replace(/^```markdown\n/, '')
            .replace(/\n```$/, '')
            .trim();
          
          let data = {};
          let body = '';
          try {
            const parsed = matter(content);
            data = parsed.data;
            body = parsed.content;
          } catch (e) {
            console.error(`YAML 파싱 오류 (${file}):`, e.message);
            data = {};
            body = content.replace(/^---[\s\S]*?---/, '');
          }

          const cleanContent = body
            .replace(/^---[\s\S]*?---/, '') // 남아있는 frontmatter 제거
            // 마크다운 헤더 정규화 (## → ###)
            .replace(/^##\s+(.*$)/gm, '### $1')
            .trim();

          // 개선된 summary 생성 - 마크다운을 평문으로 변환
          const createSummary = (content, maxLength = 150) => {
            if (!content) return '';
            
            const plainText = content
              // 이미지 제거
              .replace(/!\[.*?\]\([^)]+\)/g, '')
              // 링크를 텍스트만 남기기
              .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
              // 헤딩 제거
              .replace(/#{1,6}\s+/g, '')
              // 볼드/이탤릭 마크다운 제거
              .replace(/\*\*([^*]+)\*\*/g, '$1')
              .replace(/\*([^*]+)\*/g, '$1')
              .replace(/__([^_]+)__/g, '$1')
              .replace(/_([^_]+)_/g, '$1')
              // 코드 블록 제거
              .replace(/```[\s\S]*?```/g, '')
              .replace(/`([^`]+)`/g, '$1')
              // 연속된 공백 및 개행 정리
              .replace(/\s+/g, ' ')
              .trim();
              
            if (plainText.length <= maxLength) return plainText;
            
            // 문장 경계에서 자르기
            const lastSpaceIndex = plainText.lastIndexOf(' ', maxLength);
            const summary = plainText.substring(0, lastSpaceIndex > 0 ? lastSpaceIndex : maxLength);
            
            return summary + '...';
          };
          
          return {
            id: path.parse(file).name,
            title: data.title || path.parse(file).name,
            date: data.date || new Date().toISOString(),
            createdAt: data.date || new Date().toISOString(),
            author: data.author || '스튜디오 놀',
            category: data.category || '공지',
            tags: Array.isArray(data.tags) ? data.tags : ['기본'],
            content: cleanContent,
            summary: createSummary(cleanContent)
          };
        } catch (e) {
          console.error(`파일 처리 오류 (${file}):`, e.message);
          return null;
        }
      })
      .filter(Boolean); // null 값 제거

    fs.writeFileSync(outputFile, JSON.stringify(stories, null, 2));
    console.log(`성공적으로 ${stories.length}개의 스토리를 생성했습니다: ${outputFile}`);
  } catch (e) {
    console.error('스토리 생성 중 오류 발생:', e.message);
    process.exit(1);
  }
};

generateStories();