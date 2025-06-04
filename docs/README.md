# 스토리 마크다운 작성 가이드

## 1. 디렉토리 구조
```
content/
  stories/
    category1/  # 카테고리별 서브디렉토리 (선택사항)
      story1.md
      story2.md
    category2/
      story3.md
    images/     # 해당 스토리 전용 이미지 (선택사항)
      image1.jpg
      image2.png
```

## 2. 마크다운 파일 예시 (frontmatter 포함)

```markdown
---
title: "스토리 제목"
date: 2025-06-04
author: "작성자 이름"
category: "카테고리"
tags: ["태그1", "태그2"]
thumbnail: "/images/studio1.jpg"  # 썸네일 이미지 경로
---

## 소제목

스토리 본문 내용...

![이미지 설명](/images/studio2.jpg)
```

## 3. 이미지 추가 방법

1. 공용 이미지 사용 시: `public/images/` 디렉토리에 있는 이미지 사용
   ```markdown
   ![설명](/images/파일명.jpg)
   ```

2. 스토리 전용 이미지 사용 시: 
   - `content/stories/images/` 또는 `content/stories/카테고리/images/` 디렉토리에 이미지 저장
   ```markdown
   ![설명](./images/파일명.jpg)  # 같은 디렉토리인 경우
   ```

3. 외부 이미지 사용 시: URL 직접 입력
   ```markdown
   ![설명](https://example.com/image.jpg)
   ```

## 4. 추가 참고 사항

- Frontmatter는 YAML 형식으로 작성
- 마크다운 문법은 표준 CommonMark 지원
- 이미지 크기 조정이 필요할 경우 HTML 태그 사용:
  ```html
  <img src="/images/studio3.jpg" alt="설명" width="500">