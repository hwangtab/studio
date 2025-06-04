# 정적 스토리 게시 시스템 구축 계획

## 1. 콘텐츠 저장 구조
- **디렉토리 구조**
  ```
  content/
    └── stories/
        ├── 01-sample1.md
        ├── 02-sample2.md
        └── images/
            ├── sample1-1.jpg
            ├── sample1-2.jpg
            └── sample2-1.jpg
  ```
- **마크다운 형식 예시**
  ```markdown
  ---
  title: "스토리 제목"
  category: "project"
  date: "2023-01-01"
  thumbnail: "/images/sample1-1.jpg"
  ---

  ## 소제목
  본문 내용

  ![이미지 설명](/images/sample1-2.jpg)
  ```

## 2. JSON 변환 스크립트 설계
- **기능**
  - 마크다운 파일 파싱 (frontmatter + 내용)
  - 이미지 경로 처리
  - JSON 데이터 생성
- **샘플 스크립트 (`scripts/generateStories.js`)**
  ```javascript
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
        const content = fs.readFileSync(path.join(storiesDir, file), 'utf8');
        const { data, content: body } = matter(content);
        return {
          id: path.parse(file).name,
          ...data,
          content: body
        };
      });
    fs.writeFileSync(outputFile, JSON.stringify(stories, null, 2));
    console.log(`Generated ${stories.length} stories to ${outputFile}`);
  };

  generateStories();
  ```

## 3. 프론트엔드 데이터 로딩 방식
- **방식**: 빌드 시 생성된 `stories.json` 정적 파일 로드
- **수정 예시 (`localDataUtils.js`)**
  ```javascript
  const fetchStories = async () => {
    const response = await fetch('/data/stories.json');
    return response.json();
  };
  ```

## 4. 이미지 관리 방안
- **저장 위치**: `public/images/stories/`
- **최적화 방안**
  - WebP 형식 변환
  - 적절한 해상도 리사이징
  - Lazy loading 적용

## 5. 배포 프로세스
1. 콘텐츠 작성 (마크다운)
2. 스크립트 실행: `node scripts/generateStories.js`
3. 정적 빌드: `npm run build`
4. 배포 (Vercel, GitHub Pages 등)

## 6. 향후 개선 사항
- CMS 연동 검토
- 자동 이미지 최적화 파이프라인 구축
- CI/CD에 스토리 생성 자동화

이 계획에 대해 검토 후, 추가 요청이나 수정 사항이 있으면 알려주세요.