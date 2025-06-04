/**
 * 마크다운 텍스트에서 모든 헤더 태그 라인을 완전히 제거하는 함수
 * @param {string} markdown - 처리할 마크다운 텍스트
 * @returns {string} 헤더 태그 라인이 제거된 텍스트
 */
export function removeMarkdown(markdown) {
  if (!markdown) return '';
  
  // 모든 마크다운 헤더 라인 제거 (#, ##, ### 등)
  // ^#+.*$ 패턴: #로 시작하는 전체 라인 매칭
  let result = markdown.replace(/^#+.*$/gm, '');
  
  return result.trim();
}

// 확장된 테스트 케이스
const testText = `## 헤더 1
### 헤더 2
일반 텍스트
* 리스트 아이템

# 단일 헤더

#### 네 번째 수준 헤더

앞뒤 공백 테스트`;

console.log(removeMarkdown(testText));
/* 출력:
일반 텍스트
* 리스트 아이템



앞뒤 공백 테스트
*/