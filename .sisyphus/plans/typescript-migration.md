# TypeScript Migration

## TL;DR

> **Quick Summary**: Next.js 14 프로젝트의 전체 JavaScript 코드베이스(~52개 파일)를 TypeScript로 마이그레이션. Strict 모드 활성화, 테스트 파일 포함.
> 
> **Deliverables**:
> - tsconfig.json 및 TypeScript 환경 설정
> - 모든 .js/.jsx 파일을 .ts/.tsx로 변환 (pages, components, utils, data, lib)
> - 테스트 파일 TypeScript 변환 및 Jest 설정 업데이트
> - 빌드 및 테스트 통과 검증
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 1 (Setup) → Task 2-4 (Core Files) → Task 5-6 (Pages/Tests) → Task 7-8 (Config/Verify)

---

## Context

### Original Request
"타입스크립트로 마이그레이션" - Next.js 14 JavaScript 프로젝트를 TypeScript로 전환

### Interview Summary
**Key Discussions**:
- 마이그레이션 범위: 전체 마이그레이션 (점진적 X)
- Strictness: strict: true 활성화
- 테스트 파일: TypeScript로 변환 (ts-jest 또는 @swc/jest)
- 설정 파일: 가능한 것은 .ts로 (일부 제외)

**Research Findings**:
- 프레임워크: Next.js 14.2.5 (Static Export)
- 마이그레이션 대상: ~52개 소스 파일
- 복잡한 파일: `useAudioPlayer.js` (다중 ref와 복잡한 상태 관리)
- TypeScript 4.9.5 이미 설치됨, tsconfig.json 없음
- 일부 utils에 JSDoc 어노테이션 존재

### Metis Review
**Identified Gaps** (addressed):
- `@types/node` 누락: `lib/stories.js` (fs, path 사용), API route에 필수 → 설치 목록에 추가
- `@types/jest` 누락: 테스트 파일 타이핑에 필수 → 설치 목록에 추가
- Config 파일 전략 미정: CJS 호환성 문제 → 특정 파일 JS 유지 결정
- Interface 위치 전략 미정: 파일 colocate + 공유 시 types/ 사용으로 결정

---

## Work Objectives

### Core Objective
Next.js 14 JavaScript 코드베이스 전체를 TypeScript로 마이그레이션하여 타입 안전성을 확보하고, 빌드 및 테스트가 정상 통과하도록 함

### Concrete Deliverables
- `tsconfig.json` 생성 (strict: true)
- 모든 소스 파일 `.ts`/`.tsx` 변환 (pages, components, utils, data, lib)
- 테스트 파일 `.ts` 변환 및 Jest TypeScript 설정
- API route 타입 정의 (`NextApiRequest`, `NextApiResponse`)
- 공유 타입 정의 파일 (`types/` 디렉토리)

### Definition of Done
- [ ] `npx tsc --noEmit` → Exit code: 0
- [ ] `npm run build` → Exit code: 0, 동일한 페이지 수
- [ ] `npm test -- --watchAll=false` → Exit code: 0, 동일한 테스트 수
- [ ] `find pages components utils lib data -name "*.js" -o -name "*.jsx" | wc -l` → 0
- [ ] `npm run lint` → Exit code: 0

### Must Have
- TypeScript strict mode 활성화
- 모든 소스 파일 .ts/.tsx 변환
- 테스트 파일 TypeScript 지원
- Next.js 타입 활용 (GetStaticProps, NextApiRequest 등)
- 빌드 및 테스트 무중단

### Must NOT Have (Guardrails)
- **비즈니스 로직 변경 금지**: 타입 추가만, 동작 변경 없음
- **jest.config.js, postcss.config.js, next-sitemap.config.js 변환 금지**: CJS 호환성 문제
- **out/ 디렉토리 수정 금지**: 빌드 출력물
- **과도한 추상화 금지**: 간단한 컴포넌트에 불필요한 인터페이스 생성 지양
- **새로운 테스트 케이스 추가 금지**: 파일 변환만, 테스트 로직 변경 없음
- **ESLint 규칙 과도한 추가 금지**: @typescript-eslint/recommended만 추가

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (Jest + React Testing Library)
- **User wants tests**: YES (테스트 파일도 TypeScript로)
- **Framework**: Jest with ts-jest or @swc/jest

### Automated Verification (NO User Intervention)

**By Phase - Agent-Executable Commands:**

```bash
# Phase verification (run after each task group)
npx tsc --noEmit              # Type check passes
npm run build                  # Build succeeds  
npm test -- --watchAll=false  # Tests pass
```

**Final Verification:**

```bash
# 1. No JS source files remain (excluding configs)
find pages components utils lib data -type f \( -name "*.js" -o -name "*.jsx" \) | wc -l
# Assert: 0

# 2. Static export page count unchanged
find out -name "*.html" | wc -l  
# Assert: Same as pre-migration baseline

# 3. TypeScript strict compliance
npx tsc --noEmit
# Assert: Exit code 0, no errors
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
└── Task 1: TypeScript 환경 설정 [no dependencies]

Wave 2 (After Wave 1):
├── Task 2: Utils 마이그레이션 [depends: 1]
├── Task 3: Data 마이그레이션 [depends: 1]
└── Task 4: Lib 마이그레이션 [depends: 1]

Wave 3 (After Wave 2):
├── Task 5: Components 마이그레이션 [depends: 2, 3]
└── Task 6: Pages 마이그레이션 [depends: 2, 3, 4]

Wave 4 (After Wave 3):
├── Task 7: Tests 마이그레이션 [depends: 5, 6]
└── Task 8: Config 및 최종 검증 [depends: 7]

Critical Path: Task 1 → Task 2 → Task 5 → Task 7 → Task 8
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2, 3, 4 | None (first) |
| 2 | 1 | 5, 6 | 3, 4 |
| 3 | 1 | 5, 6 | 2, 4 |
| 4 | 1 | 6 | 2, 3 |
| 5 | 2, 3 | 7 | 6 |
| 6 | 2, 3, 4 | 7 | 5 |
| 7 | 5, 6 | 8 | None |
| 8 | 7 | None | None (final) |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1 | delegate_task(category="quick", load_skills=[], run_in_background=false) |
| 2 | 2, 3, 4 | dispatch parallel, category="quick" |
| 3 | 5, 6 | dispatch parallel, category="unspecified-low" |
| 4 | 7, 8 | sequential, category="quick" |

---

## TODOs

### Task 1: TypeScript 환경 설정

- [ ] 1. TypeScript 환경 설정

  **What to do**:
  - tsconfig.json 생성 (strict: true, Next.js 권장 설정)
  - @types 패키지 설치: @types/react, @types/react-dom, @types/node, @types/jest, @types/react-slick, @types/prismjs, @types/uuid
  - types/ 디렉토리 생성 (공유 타입용)
  - 기본 공유 타입 정의 파일 생성 (types/index.ts)

  **Must NOT do**:
  - 소스 파일 변환 (이 단계에서는 설정만)
  - ESLint 설정 변경 (별도 태스크)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단순 설정 파일 생성 및 패키지 설치 작업
  - **Skills**: []
    - 특별한 스킬 불필요

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Wave 1)
  - **Blocks**: 2, 3, 4, 5, 6, 7, 8
  - **Blocked By**: None (첫 번째 태스크)

  **References**:

  **Pattern References**:
  - `package.json:32` - 현재 TypeScript 버전 확인 (v4.9.5)
  - `package.json:6-33` - 현재 dependencies 목록 (타입 패키지 필요 여부 확인)

  **Documentation References**:
  - Next.js TypeScript 설정: https://nextjs.org/docs/pages/building-your-application/configuring/typescript
  - tsconfig.json strict 옵션: https://www.typescriptlang.org/tsconfig#strict

  **WHY Each Reference Matters**:
  - package.json: 어떤 @types 패키지가 필요한지, 현재 TS 버전 호환성 확인
  - Next.js docs: Next.js 14에 맞는 tsconfig.json 권장 설정 참고

  **Acceptance Criteria**:

  ```bash
  # tsconfig.json 존재 확인
  test -f tsconfig.json && echo "EXISTS" || echo "MISSING"
  # Assert: EXISTS

  # @types 패키지 설치 확인
  npm ls @types/react @types/react-dom @types/node @types/jest
  # Assert: 패키지들이 node_modules에 존재

  # types/ 디렉토리 존재
  test -d types && echo "EXISTS" || echo "MISSING"
  # Assert: EXISTS

  # TypeScript 컴파일 기본 동작 확인
  npx tsc --version
  # Assert: 버전 출력 (4.9.5 또는 호환 버전)
  ```

  **Commit**: YES
  - Message: `chore: setup TypeScript configuration and @types packages`
  - Files: `tsconfig.json`, `types/index.ts`, `package.json`, `package-lock.json`
  - Pre-commit: `npx tsc --version`

---

### Task 2: Utils 마이그레이션

- [ ] 2. Utils 마이그레이션 (utils/*.js → utils/*.ts)

  **What to do**:
  - utils/animationUtils.js → utils/animationUtils.ts
  - utils/dateUtils.js → utils/dateUtils.ts (기존 JSDoc 참고하여 타입 정의)
  - utils/textUtils.js → utils/textUtils.ts (기존 JSDoc 참고하여 타입 정의)
  - utils/sectionStyles.js → utils/sectionStyles.ts
  - utils/portfolioDataUtils.js → utils/portfolioDataUtils.ts
  - utils/localDataUtils.js → utils/localDataUtils.ts
  - 각 파일에 적절한 타입 정의 추가
  - JSDoc 어노테이션은 TypeScript 타입으로 대체 후 제거 가능

  **Must NOT do**:
  - 함수 로직 변경
  - 테스트 파일 변환 (별도 태스크)
  - 새로운 유틸리티 함수 추가

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단순 파일 확장자 변경 및 타입 추가, 파일 수 적음
  - **Skills**: []
    - 특별한 스킬 불필요

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4)
  - **Blocks**: 5, 6
  - **Blocked By**: 1

  **References**:

  **Pattern References**:
  - `utils/dateUtils.js:1-50` - JSDoc 어노테이션 패턴 (타입 변환 참고)
  - `utils/textUtils.js:1-30` - JSDoc 어노테이션 패턴
  - `utils/animationUtils.js` - framer-motion 타입과 함께 사용되는 애니메이션 설정

  **API/Type References**:
  - framer-motion의 Variants, Transition 타입 활용 (내장 타입 있음)

  **WHY Each Reference Matters**:
  - dateUtils.js, textUtils.js: 기존 JSDoc에서 의도한 타입을 파악하여 TypeScript 타입으로 변환
  - animationUtils.js: framer-motion 라이브러리 타입과 호환되는 타입 정의 필요

  **Acceptance Criteria**:

  ```bash
  # JS 파일이 TS로 변환되었는지 확인
  find utils -name "*.js" ! -name "*.test.js" | wc -l
  # Assert: 0

  # TS 파일 존재 확인
  ls utils/*.ts | wc -l
  # Assert: 6 이상

  # 타입 체크 통과
  npx tsc --noEmit
  # Assert: Exit code 0

  # 빌드 통과
  npm run build
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `refactor: migrate utils/ to TypeScript`
  - Files: `utils/*.ts`
  - Pre-commit: `npx tsc --noEmit`

---

### Task 3: Data 마이그레이션

- [ ] 3. Data 마이그레이션 (data/*.js → data/*.ts)

  **What to do**:
  - data/home.js → data/home.ts
  - data/services.js → data/services.ts
  - data/pricing.js → data/pricing.ts
  - data/portfolio.js → data/portfolio.ts
  - data/siteConfig.js → data/siteConfig.ts
  - 각 데이터 구조에 대한 인터페이스 정의 (types/data.ts에 공유 타입)
  - export 타입 명시 (as const 또는 interface)

  **Must NOT do**:
  - 데이터 값 변경
  - 새로운 데이터 필드 추가
  - 데이터 구조 리팩토링

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 정적 데이터 파일, 복잡한 로직 없음
  - **Skills**: []
    - 특별한 스킬 불필요

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 4)
  - **Blocks**: 5, 6
  - **Blocked By**: 1

  **References**:

  **Pattern References**:
  - `data/portfolio.js` - 포트폴리오 아이템 구조 (PortfolioItem 인터페이스 정의용)
  - `data/services.js` - 서비스 항목 구조
  - `data/pricing.js` - 가격 정책 구조

  **API/Type References**:
  - types/data.ts (새로 생성): 공유 데이터 인터페이스 정의

  **WHY Each Reference Matters**:
  - 각 data 파일의 구조를 분석하여 재사용 가능한 인터페이스 정의
  - 컴포넌트에서 props 타입으로 활용될 수 있도록 export

  **Acceptance Criteria**:

  ```bash
  # JS 파일이 TS로 변환되었는지 확인
  find data -name "*.js" | wc -l
  # Assert: 0

  # TS 파일 존재 확인
  ls data/*.ts | wc -l
  # Assert: 5

  # 타입 체크 통과
  npx tsc --noEmit
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `refactor: migrate data/ to TypeScript with interfaces`
  - Files: `data/*.ts`, `types/data.ts`
  - Pre-commit: `npx tsc --noEmit`

---

### Task 4: Lib 마이그레이션

- [ ] 4. Lib 마이그레이션 (lib/*.js → lib/*.ts)

  **What to do**:
  - lib/stories.js → lib/stories.ts
  - StoryFrontmatter 인터페이스 정의 (gray-matter 결과 타이핑)
  - fs, path 모듈 타입 활용 (@types/node)
  - 함수 반환 타입 명시

  **Must NOT do**:
  - 마크다운 파싱 로직 변경
  - 새로운 유틸리티 함수 추가

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단일 파일, Node.js API 타입 적용
  - **Skills**: []
    - 특별한 스킬 불필요

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 3)
  - **Blocks**: 6
  - **Blocked By**: 1

  **References**:

  **Pattern References**:
  - `lib/stories.js:1-100` - 전체 파일 구조, gray-matter 사용 패턴

  **API/Type References**:
  - gray-matter: `GrayMatterFile` 타입 (내장)
  - @types/node: `fs`, `path` 모듈 타입
  - remark/remark-html: 내장 타입

  **External References**:
  - gray-matter 타입: https://github.com/jonschlinkert/gray-matter#typescript

  **WHY Each Reference Matters**:
  - stories.js: frontmatter 구조 파악하여 StoryFrontmatter 인터페이스 정의
  - gray-matter 문서: GrayMatterFile<string> 타입 활용 방법

  **Acceptance Criteria**:

  ```bash
  # JS 파일이 TS로 변환되었는지 확인
  find lib -name "*.js" | wc -l
  # Assert: 0

  # TS 파일 존재 확인
  test -f lib/stories.ts && echo "EXISTS" || echo "MISSING"
  # Assert: EXISTS

  # 타입 체크 통과
  npx tsc --noEmit
  # Assert: Exit code 0

  # 빌드 통과 (stories 페이지 정상 생성)
  npm run build
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `refactor: migrate lib/stories.js to TypeScript`
  - Files: `lib/stories.ts`, `types/story.ts`
  - Pre-commit: `npx tsc --noEmit`

---

### Task 5: Components 마이그레이션

- [ ] 5. Components 마이그레이션 (components/**/*.js → components/**/*.tsx)

  **What to do**:
  - **UI Components** (components/ui/):
    - BaseCard.js → BaseCard.tsx
    - Button.js → Button.tsx
    - FeatureCard.js → FeatureCard.tsx
    - MediaGallery.js → MediaGallery.tsx
    - PortfolioCard.js → PortfolioCard.tsx
    - PricingCard.js → PricingCard.tsx
    - SectionHeading.js → SectionHeading.tsx
  - **Common Components** (components/common/):
    - ImageHero.js → ImageHero.tsx
  - **Root Components** (components/):
    - Layout.js → Layout.tsx
    - SEO.js → SEO.tsx
    - ErrorBoundary.js → ErrorBoundary.tsx
    - Button.js → Button.tsx
    - CategoryFilter.js → CategoryFilter.tsx
    - MarkdownRenderer.js → MarkdownRenderer.tsx
    - PortfolioDetailModal.js → PortfolioDetailModal.tsx
    - ResponsiveImage.js → ResponsiveImage.tsx
    - StoryCard.js → StoryCard.tsx
  - **AudioPlayer** (components/AudioPlayer/):
    - index.js → index.tsx
    - useAudioPlayer.js → useAudioPlayer.ts (복잡한 hook, 주의 필요)
    - PlayerControls.js → PlayerControls.tsx
    - ProgressBar.js → ProgressBar.tsx
    - TrackInfo.js → TrackInfo.tsx
    - VolumeControls.js → VolumeControls.tsx
  - Props 인터페이스 정의 (각 컴포넌트에 colocate)
  - React.FC 또는 function 컴포넌트 타입 적용
  - useAudioPlayer의 Ref 타입 주의: Audio | null, number (requestAnimationFrame), HTMLInputElement

  **Must NOT do**:
  - 컴포넌트 로직 변경
  - 스타일 변경
  - 새로운 props 추가
  - 컴포넌트 분리 또는 병합

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: 파일 수가 많고 (18개), useAudioPlayer는 복잡한 상태 관리 포함
  - **Skills**: []
    - 특별한 스킬 불필요

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 6)
  - **Blocks**: 7
  - **Blocked By**: 2, 3

  **References**:

  **Pattern References**:
  - `components/ui/BaseCard.js` - 기본 컴포넌트 props 패턴
  - `components/AudioPlayer/useAudioPlayer.js:1-150` - 복잡한 hook 구조 (Ref 타입 주의)
  - `components/Layout.js` - children props 패턴
  - `components/SEO.js` - Next.js Head 컴포넌트 사용 패턴

  **API/Type References**:
  - React 타입: `React.FC`, `React.ReactNode`, `React.RefObject`
  - Next.js 타입: `NextPage` (pages에서 사용)
  - framer-motion 타입: `motion` 컴포넌트 props

  **WHY Each Reference Matters**:
  - useAudioPlayer.js: 가장 복잡한 파일, Ref 타입 정의 주의 필요
    - audioRef: `Audio | null` (HTMLAudioElement 아님, new Audio() 사용)
    - animationRef: `number` (requestAnimationFrame 반환값)
    - progressBarRef: `HTMLInputElement`
  - BaseCard.js: 다른 Card 컴포넌트들의 패턴 기준

  **Acceptance Criteria**:

  ```bash
  # JS/JSX 파일이 TSX로 변환되었는지 확인
  find components -name "*.js" -o -name "*.jsx" | wc -l
  # Assert: 0

  # TSX 파일 존재 확인
  find components -name "*.tsx" -o -name "*.ts" | wc -l
  # Assert: 18 이상

  # 타입 체크 통과
  npx tsc --noEmit
  # Assert: Exit code 0

  # 빌드 통과
  npm run build
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `refactor: migrate components/ to TypeScript`
  - Files: `components/**/*.tsx`, `components/**/*.ts`
  - Pre-commit: `npx tsc --noEmit && npm run build`

---

### Task 6: Pages 마이그레이션

- [ ] 6. Pages 마이그레이션 (pages/**/*.js → pages/**/*.tsx)

  **What to do**:
  - **Root Pages** (pages/):
    - _app.js → _app.tsx (App 컴포넌트 타입)
    - _document.js → _document.tsx
    - index.js → index.tsx
    - about.js → about.tsx
    - contact.js → contact.tsx
    - lesson.js → lesson.tsx
    - portfolio.js → portfolio.tsx
    - practice-room.js → practice-room.tsx
    - pricing.js → pricing.tsx
    - studio-info.js → studio-info.tsx
    - 404.js → 404.tsx
  - **Dynamic Routes**:
    - stories/index.js → stories/index.tsx
    - stories/[id].js → stories/[id].tsx (GetStaticProps, GetStaticPaths 타입)
    - portfolio/[id].js → portfolio/[id].tsx (GetStaticProps, GetStaticPaths 타입)
  - **API Route**:
    - api/contact.js → api/contact.ts (NextApiRequest, NextApiResponse 타입)
  - Next.js 타입 활용: GetStaticProps, GetStaticPaths, NextPage, AppProps
  - Dynamic route params 타입 정의

  **Must NOT do**:
  - 페이지 로직 변경
  - 라우팅 구조 변경
  - 새로운 페이지 추가
  - API 엔드포인트 동작 변경

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: 파일 수가 많고 (14개), Next.js 특화 타입 필요
  - **Skills**: []
    - 특별한 스킬 불필요

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 5)
  - **Blocks**: 7
  - **Blocked By**: 2, 3, 4

  **References**:

  **Pattern References**:
  - `pages/_app.js` - App 컴포넌트 구조 (AppProps 타입 필요)
  - `pages/stories/[id].js` - getStaticProps, getStaticPaths 패턴
  - `pages/api/contact.js` - API route 구조 (rate limiting, 환경변수 사용)

  **API/Type References**:
  - Next.js 타입: `NextPage`, `AppProps`, `GetStaticProps`, `GetStaticPaths`, `GetStaticPropsContext`
  - Next.js API 타입: `NextApiRequest`, `NextApiResponse`
  - params 타입: `{ params: { id: string } }`

  **Documentation References**:
  - Next.js TypeScript: https://nextjs.org/docs/pages/building-your-application/configuring/typescript

  **WHY Each Reference Matters**:
  - _app.js: AppProps 타입 적용 필수
  - [id].js 파일들: GetStaticProps<Props, Params> 제네릭 타입 정확히 적용
  - api/contact.js: NextApiRequest/Response 타입, socket.remoteAddress 타입 처리

  **Acceptance Criteria**:

  ```bash
  # JS/JSX 파일이 TSX로 변환되었는지 확인
  find pages -name "*.js" -o -name "*.jsx" | wc -l
  # Assert: 0

  # TSX/TS 파일 존재 확인
  find pages -name "*.tsx" -o -name "*.ts" | wc -l
  # Assert: 14 이상

  # 타입 체크 통과
  npx tsc --noEmit
  # Assert: Exit code 0

  # 빌드 통과 (모든 페이지 정상 생성)
  npm run build
  # Assert: Exit code 0

  # 정적 페이지 수 확인 (기존과 동일)
  find out -name "*.html" | wc -l
  # Assert: 기존 baseline과 동일
  ```

  **Commit**: YES
  - Message: `refactor: migrate pages/ to TypeScript`
  - Files: `pages/**/*.tsx`, `pages/**/*.ts`
  - Pre-commit: `npx tsc --noEmit && npm run build`

---

### Task 7: Tests 마이그레이션

- [ ] 7. Tests 마이그레이션 및 Jest TypeScript 설정

  **What to do**:
  - Jest TypeScript 지원 설정 (ts-jest 또는 next/jest의 기본 TS 지원 활용)
  - `__tests__/contact-api.test.js` → `__tests__/contact-api.test.ts`
  - `utils/localDataUtils.test.js` → `utils/localDataUtils.test.ts`
  - Mock 객체 타입 정의:
    ```typescript
    type MockRequest = Partial<NextApiRequest> & { socket: { remoteAddress: string } };
    type MockResponse = {
      status: jest.Mock;
      json: jest.Mock;
      setHeader: jest.Mock;
    };
    ```
  - jest.fn() 타입: `jest.Mock`
  - global.fetch mock 타이핑

  **Must NOT do**:
  - 테스트 로직 변경
  - 새로운 테스트 케이스 추가
  - jest.config.js를 .ts로 변환 (CJS 호환성)
  - 테스트 assertion 변경

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 파일 수 적음 (2개), 단순 타입 추가
  - **Skills**: []
    - 특별한 스킬 불필요

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (Sequential)
  - **Blocks**: 8
  - **Blocked By**: 5, 6

  **References**:

  **Pattern References**:
  - `__tests__/contact-api.test.js` - 현재 테스트 구조, mock 패턴
  - `utils/localDataUtils.test.js` - 유틸리티 테스트 패턴
  - `jest.config.js` - 현재 Jest 설정 (next/jest 사용)
  - `jest.setup.js` - 테스트 setup 파일

  **API/Type References**:
  - @types/jest: `jest.Mock`, `jest.fn()`, `describe`, `it`, `expect`
  - Next.js: `NextApiRequest`, `NextApiResponse`

  **Documentation References**:
  - next/jest TypeScript 지원: https://nextjs.org/docs/pages/building-your-application/testing/jest

  **WHY Each Reference Matters**:
  - contact-api.test.js: API 테스트의 mock request/response 객체 타입 정의 필요
  - jest.config.js: next/jest가 이미 TypeScript를 지원하므로 별도 ts-jest 불필요할 수 있음

  **Acceptance Criteria**:

  ```bash
  # JS 테스트 파일이 TS로 변환되었는지 확인
  find . -name "*.test.js" -not -path "./node_modules/*" -not -path "./out/*" | wc -l
  # Assert: 0

  # TS 테스트 파일 존재 확인
  find . -name "*.test.ts" -not -path "./node_modules/*" | wc -l
  # Assert: 2

  # 테스트 통과
  npm test -- --watchAll=false
  # Assert: Exit code 0, 모든 테스트 통과

  # 타입 체크 통과
  npx tsc --noEmit
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `refactor: migrate test files to TypeScript`
  - Files: `__tests__/*.test.ts`, `utils/*.test.ts`, `types/test.ts` (mock 타입)
  - Pre-commit: `npm test -- --watchAll=false`

---

### Task 8: Config 파일 및 최종 검증

- [ ] 8. Config 파일 마이그레이션 및 최종 검증

  **What to do**:
  - next.config.js → next.config.ts (Next.js 14 지원 확인 후)
    - 주의: Next.js 14.2.5에서 next.config.ts 지원 여부 확인 필요
    - 미지원 시 next.config.mjs 또는 .js 유지
  - tailwind.config.js → tailwind.config.ts
    - Config 타입 import: `import type { Config } from 'tailwindcss'`
  - ESLint TypeScript 플러그인 추가:
    - `npm install -D @typescript-eslint/parser @typescript-eslint/eslint-plugin`
    - .eslintrc에 TypeScript 설정 추가
  - 유지해야 할 .js 파일:
    - jest.config.js (next/jest CJS 호환성)
    - postcss.config.js (PostCSS CJS 요구)
    - next-sitemap.config.js (라이브러리 요구사항)
  - 최종 빌드 및 테스트 검증

  **Must NOT do**:
  - jest.config.js, postcss.config.js, next-sitemap.config.js 변환
  - 설정 값 변경 (타입 추가만)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 설정 파일 몇 개만 변경
  - **Skills**: []
    - 특별한 스킬 불필요

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (Sequential, 마지막)
  - **Blocks**: None (최종 태스크)
  - **Blocked By**: 7

  **References**:

  **Pattern References**:
  - `next.config.js` - 현재 Next.js 설정 (static export, images)
  - `tailwind.config.js` - 현재 Tailwind 설정

  **Documentation References**:
  - Next.js config TypeScript: https://nextjs.org/docs/app/api-reference/next-config-js
  - Tailwind config TypeScript: https://tailwindcss.com/docs/configuration#type-script

  **WHY Each Reference Matters**:
  - next.config.js: Next.js 14.2.5에서 .ts 지원 여부 확인 필요 (15부터 공식 지원)
  - tailwind.config.js: Config 타입을 사용하면 자동완성 지원

  **Acceptance Criteria**:

  ```bash
  # 최종 타입 체크
  npx tsc --noEmit
  # Assert: Exit code 0

  # 최종 빌드
  npm run build
  # Assert: Exit code 0

  # 최종 테스트
  npm test -- --watchAll=false
  # Assert: Exit code 0

  # Lint 통과
  npm run lint
  # Assert: Exit code 0

  # JS 소스 파일 잔존 확인 (configs 제외)
  find pages components utils lib data -type f \( -name "*.js" -o -name "*.jsx" \) | wc -l
  # Assert: 0

  # 정적 페이지 수 확인
  find out -name "*.html" | wc -l
  # Assert: 기존 baseline과 동일

  # 허용된 JS config 파일만 남았는지 확인
  find . -maxdepth 1 -name "*.config.js" | sort
  # Assert: jest.config.js, next-sitemap.config.js, postcss.config.js 만 존재
  ```

  **Commit**: YES
  - Message: `chore: complete TypeScript migration with config updates`
  - Files: `next.config.ts` (or .mjs), `tailwind.config.ts`, `.eslintrc`
  - Pre-commit: `npm run build && npm test -- --watchAll=false && npm run lint`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `chore: setup TypeScript configuration and @types packages` | tsconfig.json, types/, package.json | `npx tsc --version` |
| 2 | `refactor: migrate utils/ to TypeScript` | utils/*.ts | `npx tsc --noEmit` |
| 3 | `refactor: migrate data/ to TypeScript with interfaces` | data/*.ts, types/data.ts | `npx tsc --noEmit` |
| 4 | `refactor: migrate lib/stories.js to TypeScript` | lib/stories.ts, types/story.ts | `npx tsc --noEmit` |
| 5 | `refactor: migrate components/ to TypeScript` | components/**/*.tsx | `npx tsc --noEmit && npm run build` |
| 6 | `refactor: migrate pages/ to TypeScript` | pages/**/*.tsx | `npx tsc --noEmit && npm run build` |
| 7 | `refactor: migrate test files to TypeScript` | *.test.ts | `npm test -- --watchAll=false` |
| 8 | `chore: complete TypeScript migration with config updates` | *.config.ts, .eslintrc | `npm run build && npm test && npm run lint` |

---

## Success Criteria

### Verification Commands
```bash
# 1. TypeScript 컴파일 무오류
npx tsc --noEmit
# Expected: Exit code 0

# 2. 빌드 성공
npm run build
# Expected: Exit code 0

# 3. 테스트 통과
npm test -- --watchAll=false
# Expected: Exit code 0, all tests pass

# 4. Lint 통과
npm run lint
# Expected: Exit code 0

# 5. JS 소스 파일 잔존 없음 (configs 제외)
find pages components utils lib data -type f \( -name "*.js" -o -name "*.jsx" \) | wc -l
# Expected: 0
```

### Final Checklist
- [ ] tsconfig.json strict: true 활성화
- [ ] 모든 @types 패키지 설치됨
- [ ] pages, components, utils, lib, data 모두 .ts/.tsx 변환
- [ ] 테스트 파일 TypeScript 변환 및 통과
- [ ] 빌드 출력물 동일 (페이지 수, 에러 없음)
- [ ] ESLint TypeScript 플러그인 적용
- [ ] 비즈니스 로직 변경 없음
