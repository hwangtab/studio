# 스튜디오 놀 웹사이트 리팩토링 계획안 (개정)

최근 PR/이슈에서 확인된 현황을 반영해 리팩토링 계획을 보완했습니다. 기존 계획은 “컴포넌트 분리/데이터 추출” 수준에 머물러 있었으므로, 실제 코드베이스(`pages/pricing.js`, `pages/portfolio.js`, `components/AudioPlayer.js` 등)에 맞춘 실행 단계와 품질 게이트를 명확히 정의합니다.

---

## 1. 현황 요약
- `pages/pricing.js`처럼 데이터 배열과 뷰가 한 파일에 공존해 읽기 어렵고, 가격표가 다른 페이지와 타이포/레イ아웃이 어긋나는 사례가 이미 발생했습니다.
- `pages/portfolio.js`, `components/AudioPlayer.js` 등은 최근 UX 요구사항(샘플 트랙 배치 변경, 플레이어 색상 수정 등)에 따라 자주 수정되고 있는데, 각 페이지별로 비슷한 로직이 중첩되어 재작업 비용이 큽니다.
- 공통 디자인 토큰은 `tailwind.config.js` / `utils/animationUtils.js`에 존재하지만 카드/타이틀/갤러리 컴포넌트들이 이를 직접 사용하지 않아 일관성이 쉽게 깨집니다.

---

## 2. 리팩토링 목표 (업데이트)
1. **UI 패턴의 모듈화**  
   - 카드, 섹션 타이틀, CTA, 오디오 플레이어 등 반복되는 패턴을 재사용 가능한 컴포넌트로 승격하고, props 기반으로 딱 필요한 데이터만 주입하도록 합니다.
2. **데이터와 뷰 분리**  
   - 가격, 서비스, 갤러리, 포트폴리오 등 정적 데이터는 `data/` 폴더에서 관리하며, JSON/JS 객체로 재사용합니다.
3. **디자인 시스템 준수**  
   - 제목/타이포/색상 클래스를 공통 util에서만 불러 쓰도록 하여 “가격 페이지 히어로 크기 불일치” 같은 이슈를 방지합니다.
4. **접근성 및 SEO 개선**  
   - 섹션 anchor, aria-label, schema 데이터 등을 컴포넌트에서 기본 제공하도록 함으로써, 각 페이지가 별도로 구현하지 않아도 일정 수준의 접근성이 확보되도록 합니다.

---

## 3. 리팩토링 항목

### 3.1 UI 컴포넌트 계층
| 컴포넌트 | 적용 대상 | 설명 |
| --- | --- | --- |
| `components/ui/SectionHeading` | `pages/pricing.js`, `pages/about.js`, `pages/portfolio.js` | 타이틀/서브타이틀/아이콘 옵션을 지원하고, 타이포 스타일을 고정 |
| `components/ui/BaseCard` & 변형 | pricing 카드, about 카드, testimonial 카드 | 아이콘/헤더/바디 구조를 공통화하고, variant로 그림자나 추천 뱃지 처리 |
| `components/ui/MediaGallery` | Home의 `StudioGallery`, 포트폴리오 이미지 목록 | `react-slick` 설정을 숨기고, responsive breakpoint만 props로 노출 |
| `components/common/HeroBanner` | `pages/index.js`, `pages/pricing.js`, `pages/practice-room.js` | 배경 그라디언트, 애니메이션, CTA를 통합한 히어로 컴포넌트 |
| `components/players/AudioPlayer` | 현재 컴포넌트 개선 | 색상/레이아웃 토글을 props화해 다른 페이지에서 재사용 가능하게 함 |

### 3.2 데이터/상수 구조
```
data/
 ├─ pricing.js         # 녹음/믹싱/마스터링/부가 서비스 가격 배열
 ├─ services.js        # About/홈에서 쓰는 서비스 카드 데이터
 ├─ portfolio.js       # 포트폴리오 카드, 샘플 트랙 메타데이터
 └─ siteConfig.js      # 주소, 연락처, SNS, VAT 표기 등 공통 상수
```
- `pages/*.js`에서는 위 데이터를 import하여 map 렌더링만 담당.
- `siteConfig`는 footer, contact, SEO schema 모두에서 공유.

### 3.3 레이아웃/스타일 정비
- **히어로 타이틀**: `pages/pricing.js`에서 스타일이 다른 사례가 있었으므로, `HeroBanner`가 내부적으로 `text-heading-1 font-title` 스타일을 적용하도록 강제.
- **애니메이션**: `motion.div` 사용 시 `PAGE_TITLE_ANIMATION` 등 공통 상수를 사용하도록 lint rule 혹은 PR 체크리스트에 추가.
- **오디오 플레이어**: 모바일/데스크톱 컨트롤 alignment 이슈가 반복되었으므로, `components/players/AudioPlayer`에서 layout prop(`"stack" | "grid"`)을 제공하고 기본을 grid로 설정.
- **SEO schema**: `components/SEO`가 `schema` prop을 이미 받도록 확장되었으므로, 각 페이지에서 구조화 데이터를 선언하는 규칙을 문서화합니다.

### 3.4 코드 품질 게이트
- Storybook 또는 간단한 `components/ui/Card.stories.js` 등 구성 요소를 독립적으로 시각 테스트할 수 있는 환경을 마련.
- 새 컴포넌트 작성 시 `docs/design_review.md`에 정의된 컬러/타이포 규칙을 만족하는지 체크.

---

## 4. 실행 단계

### Phase 1 – 데이터/상수 추출 (1~2일)
1. `data/` 폴더 생성 후 Pricing/Services/Portfolio/SiteConfig 데이터를 분리.
2. `pages/pricing.js`, `pages/about.js`, `pages/portfolio.js`에서 하드코딩된 배열 제거, `import`로 대체.
3. `lib/portfolio.js`에서 데이터 가공 함수(`hydratePortfolioData`)가 새 데이터 구조와 호환되는지 점검.

### Phase 2 – 공통 컴포넌트 도입 (2~3일)
1. `components/ui/SectionHeading`, `components/ui/BaseCard` 구현 후 pricing/about에 적용.
2. `components/ui/MediaGallery`를 만들고 Home/Practice 페이지의 갤러리를 교체.
3. `components/common/HeroBanner`로 히어로 섹션을 통일하고, 타이포 오차를 근본적으로 방지.

### Phase 3 – 페이지 리팩토링 (3~4일)
1. Home: Hero, Services, Gallery를 모두 컴포넌트화하고 data-driven 렌더링으로 전환.
2. About: `data/services.js`를 사용하고 카드 컴포넌트를 적용.
3. Pricing: `data/pricing.js` + `SectionHeading` + `BaseCard` + `FAQ/FAQSchema` 정리.
4. Portfolio: AudioPlayer의 props화 및 샘플 트랙 섹션을 컴포넌트로 추출, 스크롤 anchor 제공.

### Phase 4 – QA 및 자동화 (1~2일)
1. Playwright 또는 Cypress로 핵심 뷰(가격/포트폴리오/문의)를 캡처해 회귀를 방지.
2. ESLint 규칙에 `pages/` 내에서 동일한 Tailwind 클래스 반복을 감지하는 custom rule을 고려.
3. PR 체크리스트에 “데이터 분리 여부, SectionHeading 사용 여부, HeroBanner 사용 여부” 등을 추가.

---

## 5. 기대 효과 (정량/정성)
- 페이지별 소스 크기 30~50% 감소, 중복된 카드/섹션 코드 제거.
- 가격/서비스/포트폴리오 업데이트 시 data 파일만 수정하면 되어 QA 범위 축소.
- 디자인/타이포, 애니메이션, SEO schema가 컴포넌트 레벨에서 표준화되어 이후 수정 시 일관성을 확보.
- AudioPlayer/샘플 트랙 UX 요구사항이 늘어도 props 변경만으로 대응 가능.

---

## 6. 리스크 및 대응
- **대규모 파일 이동**으로 인한 Git 히스토리 추적 어려움 → `git mv` 활용 및 PR 단위를 Phase별로 나누어 리뷰 편의를 확보.
- **데이터 파일 변경 시 타입 안정성 부족** → TypeScript 전환 전이라도 `prop-types` 혹은 JSDoc 타입 정의로 인터페이스를 문서화.
- **기존 페이지 스타일 변형** → Figma/디자인 문서를 참고해 각 리팩토링 단계마다 스크린샷 비교를 의무화.

---

이 문서는 리팩토링 진행 시의 기준점이며, Phase 완료 시마다 docs를 업데이트하여 실제 구조와 계획이 일치하도록 관리합니다.***
