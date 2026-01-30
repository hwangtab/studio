# Draft: TypeScript Migration

## Project Analysis Summary

### Project Type
- **Framework**: Next.js v14.2.5 (Static Export mode)
- **React Version**: 18.2.0
- **Styling**: Tailwind CSS v3.4.7
- **Build Tool**: Next.js with PostCSS

### Files to Migrate
- **Total JS/JSX files**: ~45 source files (excluding `/out/` build artifacts)
- **Pages**: 12 files in `pages/` (including dynamic routes)
- **Components**: ~18 files in `components/`
- **Utils**: 5 files in `utils/`
- **Data**: 5 files in `data/`
- **Lib**: 1 file (`stories.js`)
- **Config files**: 5 files (next.config.js, tailwind.config.js, etc.)
- **Tests**: 2 test files

### Current Patterns Observed
- Functional components with Hooks (useState, useEffect, useRef, useCallback)
- No PropTypes or existing TypeScript interfaces
- Limited JSDoc annotations in utils (dateUtils.js, textUtils.js)
- Local state management only (no Redux/Zustand)
- Complex stateful hook: useAudioPlayer.js

### Dependencies Status
- `typescript` already in package.json (v4.9.5)
- Missing @types packages needed:
  - @types/react
  - @types/react-dom
  - @types/react-slick
  - @types/prismjs
  - @types/uuid

### Libraries with Built-in Types
- framer-motion ✓
- lucide-react ✓
- gray-matter ✓
- remark-* ✓

### Test Infrastructure
- **Framework**: Jest with React Testing Library
- **Config**: jest.config.js, jest.setup.js
- **Current tests**: contact-api.test.js, localDataUtils.test.js

---

## Open Questions

1. **Migration Scope**: 전체 마이그레이션 vs 점진적 마이그레이션?
2. **Strictness Level**: strict mode 사용 여부?
3. **Config Files**: .js config 파일들도 .ts로 변환?
4. **Test Files**: 테스트 파일도 TypeScript로?

---

## Decisions Made

### Migration Scope
- **전체 마이그레이션**: 모든 .js/.jsx 파일을 .ts/.tsx로 변환
- 점진적 마이그레이션 거부 (allowJs 불필요)

### Strictness Level
- **Strict Mode 활성화**: strict: true
- null/undefined 철저히 체크
- 엄격한 타입 검사 적용

### Test Files
- **테스트도 TypeScript로 변환**
- ts-jest 또는 @swc/jest 설정 필요
- jest.config.js → jest.config.ts 변환

### Config Files
- **가능한 것은 .ts로 변환**
- next.config.ts (Next.js 15 스타일 가능 여부 확인 필요)
- tailwind.config.ts
- postcss.config.js (JS 유지 - PostCSS 호환성)

### Migration Strategy
1. tsconfig.json 생성 및 @types 패키지 설치
2. Leaf nodes 먼저: utils/, data/
3. Components: ui/ → common/ → AudioPlayer/
4. Pages 마이그레이션
5. Tests 마이그레이션
6. Config 파일 마이그레이션
7. 최종 빌드 검증

