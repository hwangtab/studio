# Studio NOL — Editorial Cinematic Design System

> Studio NOL의 디자인 시스템. 합성 출처: Notion(따뜻한 미니멀 베이스) · Apple(시네마틱 화이트스페이스 + 사진 우선) · ElevenLabs(다크 히어로 밴드 + atmospheric gradient orb).
> AI 에이전트에게 "이 DESIGN.md 톤으로 만들어줘"라고 지시하면, Studio NOL의 어떤 페이지/컴포넌트라도 일관된 톤으로 생성된다.

---

## 1. Visual Theme & Atmosphere

Studio NOL은 **음악 스튜디오의 차분한 전문성**과 **잡지 같은 에디토리얼 호흡**을 동시에 갖는다. 베이스 캔버스는 따뜻한 화이트(`#faf9f7`)로, 차가운 회색이 아니라 **종이 같은 미세한 노란 언더톤**을 띤다. 텍스트는 순흑이 아닌 **웜 니어블랙**(`#1d1b1a`) — 가독성을 해치지 않으면서 인쇄물 같은 부드러움을 만든다.

브랜드의 색은 **컬러 액센트가 아니라 분위기(atmosphere)** 로 표현한다. 페이지에는 채도 높은 단색 CTA 대신, **부드러운 파스텔 그라디언트 오브**(mint → peach → lavender → sky → rose)가 히어로/섹션 배경에 떠다닌다. 이것이 음악·창작·다국적 정서를 묶는 시각 모티프다.

히어로 1차에는 **다크 시네마틱 밴드**(`#0c0a09`)가 등장 — 스튜디오의 정체성·녹음실의 어둠·청취 경험을 연상시킨다. 그 외 본문 영역은 라이트 캔버스로 돌아와 7개 언어의 긴 본문을 편안하게 읽게 한다.

타이포는 **Display Light (Montserrat 300) + Noto Sans KR 4-weight**. 디스플레이는 가벼운 weight 300으로 두께를 빼고, 본문은 한국어 가독성을 위해 normal letter-spacing을 유지한다. 보더는 **속삭임 라인**(`1px solid rgba(0,0,0,0.08)`), 섀도우는 **다층 누적 섀도우**(개별 opacity ≤ 0.05)로 인쇄물 같은 자연스러운 입체감을 만든다.

**핵심 특성**
- 따뜻한 종이톤 캔버스 `#faf9f7` + 웜 니어블랙 `#1d1b1a`
- 단색 CTA가 아닌 **5색 atmospheric gradient orb** (mint/peach/lavender/sky/rose)
- 시네마틱 다크 히어로 밴드(`#0c0a09`) + 라이트 본문의 alternation
- Display는 weight 300, 본문은 4-weight 시스템(300/400/500/700)
- Whisper border `rgba(0,0,0,0.08)` + 다층 섀도우(개별 ≤ 0.05)
- Pill primary CTA (잉크 색), 본문 link는 Notion Blue 단일
- 7개 언어 본문 가독성을 위해 line-height 1.6 유지, display 외 negative letter-spacing 사용 자제
- 라이트/다크 토글 유지 — 다크 모드는 시네마틱 다크 히어로 톤을 전체 확장

---

## 2. Color Palette & Roles

### Ink & Canvas (베이스)
| Token | Hex | Role |
|---|---|---|
| `ink` | `#1d1b1a` | Primary text, headings — 웜 니어블랙 |
| `ink-muted-80` | `#3a3633` | Secondary text on light |
| `ink-muted-60` | `#615d59` | Tertiary text, muted labels |
| `ink-muted-40` | `#a39e98` | Placeholder, disabled |
| `canvas` | `#faf9f7` | 기본 페이지 배경 (따뜻한 화이트) |
| `canvas-soft` | `#ffffff` | 카드·섹션 위 surface |
| `canvas-warm` | `#f3f1ec` | Alternation 섹션, 약한 fill |
| `canvas-deep` | `#0c0a09` | 다크 히어로/시네마틱 밴드 |
| `surface-dark-elevated` | `#1c1917` | 다크 모드 위 카드 |
| `on-dark` | `#ffffff` | 다크 위 본문 |
| `on-dark-soft` | `#a8a29e` | 다크 위 muted |

### Hairline & Shadow
| Token | Value | Role |
|---|---|---|
| `hairline` | `1px solid rgba(0,0,0,0.08)` | 표준 보더 (whisper) |
| `hairline-strong` | `1px solid rgba(0,0,0,0.14)` | 폼 입력 보더 |
| `shadow-card` | `0 4px 18px rgba(0,0,0,0.04), 0 2px 7.85px rgba(0,0,0,0.027), 0 0.8px 2.93px rgba(0,0,0,0.02), 0 0.175px 1.04px rgba(0,0,0,0.01)` | 표준 카드 |
| `shadow-deep` | `0 1px 3px rgba(0,0,0,0.01), 0 3px 7px rgba(0,0,0,0.02), 0 7px 15px rgba(0,0,0,0.02), 0 14px 28px rgba(0,0,0,0.04), 0 23px 52px rgba(0,0,0,0.05)` | 모달·featured |

### Atmospheric Gradient Orbs (브랜드 액센트)
음악 스튜디오 정체성의 핵심. 단색 CTA로 쓰지 않고, 히어로/섹션 배경에 **blur 80~160px**로 떠다니는 오브로 사용.

| Token | Hex | Role |
|---|---|---|
| `orb-mint` | `#a7e5d3` | 메인(스튜디오 시그니처) |
| `orb-peach` | `#f4c5a8` | 따뜻한 액센트 |
| `orb-lavender` | `#c8b8e0` | 야상·녹음실 |
| `orb-sky` | `#a8c8e8` | 청량·다국어 글로벌 |
| `orb-rose` | `#e8b8c4` | 감성·스토리 |

### Interactive
| Token | Hex | Role |
|---|---|---|
| `link` | `#0a66c2` | 본문 inline link (Notion Blue 계열, 한국어 가독성↑) |
| `link-on-dark` | `#62aef0` | 다크 배경 위 link |
| `focus` | `#097fe8` | 포커스 ring |
| `badge-bg` | `#f2f9ff` | Pill badge 배경 |
| `badge-text` | `#097fe8` | Pill badge 텍스트 |

### Semantic
| Token | Hex | Role |
|---|---|---|
| `success` | `#16a34a` | 성공 상태 |
| `warning` | `#dd5b00` | 경고 |
| `error` | `#dc2626` | 오류 |

---

## 3. Typography Rules

### Font Stacks
- **Display** (히어로/섹션 타이틀, 영문/숫자 우선):
  `'Montserrat', 'Noto Sans KR', system-ui, -apple-system, sans-serif`
- **Body** (한국어 포함 모든 본문/UI):
  `'Noto Sans KR', 'Inter', -apple-system, BlinkMacSystemFont, system-ui, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif`
- **Mono** (코드/메타): 기존 stack 유지
  `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`

### Hierarchy (Desktop)

| Role | Family | Size | Weight | Line | Letter-spacing | Notes |
|---|---|---|---|---|---|---|
| Display Mega | Display | 64px | 300 | 1.05 | -0.02em (영문) / 0 (한글) | 히어로 메인. 한글일 땐 spacing 해제 |
| Display XL | Display | 48px | 300 | 1.08 | -0.015em / 0 | 페이지 헤드 |
| Display LG | Display | 36px | 300 | 1.17 | -0.01em / 0 | 섹션 타이틀 |
| Display MD | Display | 28px | 400 | 1.2 | 0 | 카드 그룹 헤드 |
| Lead | Body | 22px | 400 | 1.45 | 0 | 히어로 서브, 인트로 |
| Title MD | Body | 20px | 500 | 1.4 | 0 | 카드 타이틀 |
| Title SM | Body | 18px | 500 | 1.45 | 0 | 카드 서브 |
| Body | Body | 16px | 400 | 1.6 | 0 | 표준 본문 (다국어 가독성) |
| Body Strong | Body | 16px | 500 | 1.6 | 0 | UI/네비/강조 |
| Body SM | Body | 15px | 400 | 1.6 | 0 | 보조 본문 |
| Caption | Body | 14px | 400 | 1.5 | 0 | 메타·캡션 |
| Caption Upper | Body | 12px | 600 | 1.4 | 0.08em | UPPERCASE 라벨 (영문만) |
| Button | Body | 15px | 500 | 1.0 | 0 | CTA 텍스트 |

### Principles
1. **Display weight 300** — Studio NOL의 인쇄물 같은 가벼운 시그니처. 두꺼운 헤드라인 사용 자제.
2. **다국어 본문은 line-height 1.6** — 한국어/태국어/우즈벡어 모두 행간 충분히 확보.
3. **Negative letter-spacing은 영문 display만** — 한국어/CJK에서는 자간 압축 시 가독성 저하 심각하므로 0 유지.
4. **4-weight 시스템**: 300(Display) · 400(Body/Read) · 500(UI/강조) · 700(Headings 대안).
5. **Caption-uppercase 0.08em** — 한글 라벨엔 사용 금지(가독성), 영문/숫자 메타에만.

---

## 4. Component Stylings

### Buttons

**Primary — Ink Pill** (대표 CTA)
- bg: `#1d1b1a` (ink)
- text: `#ffffff`
- typography: Button (15px / 500)
- radius: `9999px` (pill)
- padding: `10px 20px`, height 40px
- hover: bg `#0c0a09`
- active: scale(0.97)
- focus: 2px outline `#097fe8`

**Secondary — Outline**
- bg: transparent
- text: `#1d1b1a`
- border: `1px solid rgba(0,0,0,0.14)`
- radius: `9999px`
- padding: `9px 19px`, height 40px
- hover: bg `rgba(0,0,0,0.04)`

**Tertiary — Text Link Button**
- bg: transparent
- text: `#1d1b1a`
- decoration: 호버 시 underline
- 사용: 보조 액션, inline CTA

**On-Dark Primary**
- bg: `#ffffff`
- text: `#0c0a09`
- 위와 동일 스펙. 다크 히어로 밴드 위 사용.

### Cards
- bg: `canvas-soft` (`#ffffff`)
- border: `1px solid rgba(0,0,0,0.08)` (whisper)
- radius: `12px` (표준), `16px` (hero/featured), `24px` (gradient orb 카드)
- shadow: `shadow-card`
- hover: shadow 강화 + translate-y(-2px)
- padding: 24px (표준), 32px (featured)

### Inputs / Forms
- bg: `#ffffff`
- text: `#1d1b1a`
- border: `1px solid rgba(0,0,0,0.14)`
- radius: `8px`
- padding: `10px 14px`
- focus: border `#097fe8`, ring `2px rgba(9,127,232,0.2)`
- placeholder: `#a39e98`
- 라벨은 14px / 500, 본문 위 8px 간격

### Navigation
- 라이트 모드: bg `#faf9f7`, height 64px, **no shadow** — `border-bottom: 1px solid rgba(0,0,0,0.08)`
- 다크 모드: bg `rgba(12,10,9,0.85)` + `backdrop-filter: blur(12px)`, sticky
- Brand wordmark 좌측 (Display 18px / 500)
- Nav links: Body 15px / 500, `#1d1b1a`, hover 시 `opacity 0.7`
- 우측: 언어 셀렉터 + Primary Pill CTA

### Pill Badge
- bg: `#f2f9ff`
- text: `#097fe8`
- typography: 12px / 600, letter-spacing 0.08em
- radius: 9999px, padding `4px 10px`
- "NEW", "EVENT" 등 영문 라벨

### Story Card (스토리 콘텐츠)
- bg: `#ffffff`
- thumbnail: 16:9, `border-radius: 12px 12px 0 0`, whisper border
- title: Title MD (20px / 500), 2줄 클램프
- excerpt: Body SM (15px / 400), `#615d59`, 3줄 클램프
- meta: Caption (14px / 400), `#a39e98`
- hover: shadow + translate-y(-2px)

### Hero — Cinematic Dark Band
- bg: `#0c0a09`
- 배경 위 **gradient orb 2~3개** absolute, blur 120px, opacity 0.4~0.6
- text: `#ffffff` (헤드라인) + `#a8a29e` (서브)
- 헤드라인: Display Mega 64px / 300
- CTA: On-Dark Primary
- 좌우 padding clamp(24px, 6vw, 96px), 위아래 96~120px

### Hero — Light Editorial
- bg: `#faf9f7`
- 풀블리드 사진(2:3 또는 1:1) 우측 배치
- 좌측: Display XL 48px / 300, 본문 Lead 22px, Primary Pill CTA
- 사진엔 whisper border + 12px radius

### Atmospheric Section Background
- bg: `#faf9f7`
- absolute positioned `<div>` 1~2개:
  - size 600~900px, `border-radius: 50%`
  - `background: radial-gradient(circle, var(--orb-mint) 0%, transparent 70%)`
  - `filter: blur(120px)`
  - opacity 0.35~0.5
- z-index 0, content는 z-index 1

---

## 5. Layout Principles

### Spacing Scale (8px base)
`4 · 8 · 12 · 16 · 20 · 24 · 32 · 48 · 64 · 80 · 96 · 120 · 160`

### Container
- max-width 1200px (표준 본문)
- max-width 1400px (히어로/사진 전용 와이드)
- 좌우 padding `clamp(16px, 4vw, 48px)`

### Vertical Rhythm
- 섹션 사이 **96~120px** (모바일 56~64px)
- 카드 그리드 gap **24~32px**
- 카드 내부 padding **24~32px**

### Whitespace Philosophy
- **호흡**: Apple식 generous vertical padding. 한 화면 = 한 메시지.
- **Alternation**: white(`#faf9f7`) → soft warm(`#f3f1ec`) → dark cinematic(`#0c0a09`) 3단계 리듬으로 단조로움 회피.
- **Photography first**: 텍스트보다 사진이 먼저 의미를 전달. 사진 위에 텍스트 오버레이 자제, 옆에 배치 선호.

### Radius Scale
`0 · 4 · 8 · 12 · 16 · 24 · 9999(pill)`
- 4px: 입력 필드의 inner element
- 8px: 인풋, 작은 컨테이너
- 12px: 표준 카드, 이미지
- 16px: hero/featured 카드
- 24px: gradient orb 카드, 큰 컨테이너
- pill: 모든 버튼·뱃지

---

## 6. Depth & Elevation

| Level | Treatment | Use |
|---|---|---|
| 0 (Flat) | shadow none, border none | 페이지 본문, 텍스트 블록 |
| 1 (Whisper) | `1px solid rgba(0,0,0,0.08)` | 카드 outline, divider |
| 2 (Soft Card) | `shadow-card` (4-layer, max 0.04) | 표준 카드, story card |
| 3 (Deep) | `shadow-deep` (5-layer, max 0.05, 52px blur) | 모달, featured 패널, hero card |
| 4 (Atmospheric) | gradient orb blur 120px | 히어로/섹션 배경 분위기 |
| Focus | `2px solid #097fe8` outline | 키보드 포커스 |

---

## 7. Do's and Don'ts

### Do
- Display는 **weight 300** 으로 가볍게.
- 그라디언트 오브는 **blur ≥ 80px, opacity ≤ 0.6** 으로 분위기만 연출.
- 본문은 **line-height 1.6** 유지 (다국어).
- 라이트 캔버스와 다크 시네마틱 밴드의 **alternation**을 살린다.
- 사진은 **whisper border + 12px radius**.

### Don't
- ❌ 채도 높은 단색 컬러 CTA (보라/핑크/형광 그린 등) — atmospheric orb로 대체.
- ❌ 한국어 본문에 **negative letter-spacing**.
- ❌ **두꺼운 보더** (1px 이상) 또는 **하드 섀도우** (개별 opacity > 0.08).
- ❌ Display weight 700+ 의 무거운 헤드라인.
- ❌ 사진 위 텍스트 오버레이 (가독성·다국어 모두 불리).
- ❌ Caption uppercase + 한글 (자간 0.08em이 한글에서는 깨져 보임).

---

## 8. Responsive Behavior

### Breakpoints (현재 tailwind 유지)
| Name | Width |
|---|---|
| sm | 640px |
| md | 768px |
| lg | 1024px |
| xl | 1280px |
| 2xl | 1536px |
| 3xl | 1800px |

### Collapsing Strategy
- Display Mega: 64px → 48px(md) → 36px(sm)
- Lead: 22px → 20px(md) → 18px(sm)
- 섹션 padding: 120px → 80px(md) → 56px(sm)
- 카드 그리드: 3-col → 2-col(md) → 1-col(sm)
- Hero: 좌측 텍스트 / 우측 사진 → 위 텍스트 / 아래 사진 (md 이하)
- 네비: 가로 링크 + CTA → 햄버거 (md 이하)

### Touch Targets
- 버튼·링크 최소 높이 **44px** (Apple HIG)
- 모바일 폼 인풋 padding `12px 16px`
- 언어 셀렉터 dropdown 항목 최소 48px

---

## 9. Agent Prompt Guide

### Quick Color Reference
- Canvas: `#faf9f7`  · Canvas Warm: `#f3f1ec`  · Canvas Deep: `#0c0a09`
- Ink: `#1d1b1a`  · Muted: `#615d59`  · Disabled: `#a39e98`
- Hairline: `1px solid rgba(0,0,0,0.08)`
- Orbs: mint `#a7e5d3` · peach `#f4c5a8` · lavender `#c8b8e0` · sky `#a8c8e8` · rose `#e8b8c4`
- Link: `#0a66c2`  · Focus: `#097fe8`

### Example Prompts
- **히어로 (다크 시네마틱)**:
  "Studio NOL 히어로 섹션. 배경 `#0c0a09`, 우상단에 mint orb (radial-gradient blur 120px opacity 0.5), 좌하단에 lavender orb. 헤드라인 Montserrat 64px weight 300 line-height 1.05 letter-spacing -0.02em white. 서브 22px Noto Sans KR weight 400 `#a8a29e`. CTA: 흰색 pill 버튼 (bg #fff, text #0c0a09, 10px 20px, radius 9999px). 좌우 padding clamp(24px, 6vw, 96px), 상하 120px."

- **스토리 카드**:
  "Studio NOL 스토리 카드. bg #ffffff, border 1px solid rgba(0,0,0,0.08), radius 12px, shadow 4-layer (0 4px 18px rgba(0,0,0,0.04) ...). 상단 16:9 썸네일 (radius 12px 12px 0 0). 본문 padding 24px. 타이틀 Noto Sans KR 20px / 500, 2줄 클램프. 발췌 15px / 400 #615d59 3줄 클램프. 메타 14px #a39e98. hover 시 translate-y(-2px) + shadow 강화."

- **에디토리얼 본문 섹션**:
  "Studio NOL 본문 섹션. bg #faf9f7. 우상단에 peach orb blur 100px opacity 0.4. max-width 1200px centered, padding 96px 48px. 섹션 타이틀 Montserrat 36px / 300, 본문 Noto Sans KR 16px / 400 line-height 1.6 #3a3633. 보조 텍스트 #615d59. 보더 없음, 다음 섹션은 #f3f1ec로 alternation."

- **컨택트 폼**:
  "Studio NOL 컨택트 폼. bg #ffffff card with whisper border + shadow-card, padding 32px, radius 16px. 라벨 14px / 500 #1d1b1a. 인풋 bg #fff, border 1px solid rgba(0,0,0,0.14), radius 8px, padding 10px 14px, focus border #097fe8 + ring 2px rgba(9,127,232,0.2). Submit는 ink pill 버튼."

### Iteration Guide
1. 채도 높은 단색이 들어가면 멈춰라. atmospheric orb로 대체.
2. 한글 본문에 letter-spacing이 음수로 들어가면 0으로 되돌려라.
3. Display weight가 600+면 300으로 내려라 (Studio NOL의 시그니처).
4. 보더가 1px 초과거나 색이 진하면 `rgba(0,0,0,0.08)`로 통일.
5. 섀도우가 단층이거나 opacity 0.1+면 다층 stack으로 교체.
6. 라이트→다크 alternation 없이 같은 배경이 3섹션 연속이면 하나를 `canvas-warm` 또는 `canvas-deep`으로.
7. 모바일에서 헤드라인이 안 줄어들면 clamp / breakpoint scaling 추가.

---

## Appendix — 현재 코드와의 매핑

| 현재 (`tailwind.config.ts`) | 신규 토큰 | 비고 |
|---|---|---|
| `primary.DEFAULT #6d28d9` | (제거) | 보라 단색 → atmospheric orb로 대체 |
| `secondary.DEFAULT #be185d` | (제거) | 핑크 단색 → orb-rose / orb-peach |
| `accent.DEFAULT #047857` | (제거) | 에메랄드 → orb-mint |
| `gray.500 #4b5563` | `ink-muted-60 #615d59` | 웜 톤으로 이동 |
| `gray.800 #111827` | `ink #1d1b1a` | 웜 니어블랙 |
| `gray.50 #f9fafb` | `canvas #faf9f7` | 웜 화이트 |
| `font-display: Montserrat` | 유지, weight 300 우선 | Display 시그니처 |
| `font-sans: Noto Sans KR` | 유지, 4-weight (300/400/500/700) | 다국어 본문 |
| `display-1 / heading-1` 등 | DESIGN.md §3 hierarchy로 재정의 | font-weight 700 → 300 (display)로 전환 |

> 마이그레이션은 한 번에 하지 않는다. (1) 신규 컬러 토큰 추가 → (2) 신규 페이지/컴포넌트부터 적용 → (3) 기존 페이지 점진 마이그레이션. CLAUDE.md의 "Don't add features beyond what task requires" 원칙에 따라 PR 단위로 잘라서 진행.
