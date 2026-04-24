# 포트폴리오 메타데이터 일괄 입력 가이드

Phase 0.1-C 용도 — `data/portfolio.ts`의 포트폴리오 34개 중 **23개**에 결락된 `releaseDate` / `label` / `credits`를 CSV로 일괄 주입.

## 파일 구성

| 파일 | 역할 |
|---|---|
| [docs/portfolio-metadata-template.csv](portfolio-metadata-template.csv) | **편집 대상.** 34행(=34개 포트폴리오) 현재 상태가 채워져 있음. 빈 칸을 채우기만 하면 됨. |
| [scripts/apply-portfolio-metadata.js](../scripts/apply-portfolio-metadata.js) | CSV를 읽어 `data/portfolio.ts`에 주입. 빈 칸은 건너뛰고 기존 값 보존. |

## 작업 순서

1. `docs/portfolio-metadata-template.csv`를 Excel / Numbers / Google Sheets로 엽니다.
2. 비어 있는 23개 행의 칸을 채웁니다. (규칙은 아래 참조)
3. CSV 형식으로 저장 (원본 파일 덮어쓰기).
4. 드라이런으로 어떤 아이템이 업데이트될지 먼저 확인:
   ```bash
   node scripts/apply-portfolio-metadata.js --dry-run
   ```
5. 실제 적용:
   ```bash
   node scripts/apply-portfolio-metadata.js
   ```
6. 변경 검증:
   ```bash
   npm run type-check
   npm run lint
   ```

## CSV 컬럼 규칙

| 컬럼 | 형식 | 예시 | 비고 |
|---|---|---|---|
| `id` | 수정 금지 | `tierliner-bite-me` | 스크립트가 이걸로 매칭 |
| `title` | 수정 금지 | `티어라이너 <Bite Me>` | 참조용 |
| `artist` | 수정 금지 | `티어라이너` | 참조용 |
| `releaseDate` | `YYYY-MM-DD` | `2024-03-15` | ISO 8601. 모르면 비워두기 |
| `label` | 자유 텍스트 | `Studio NOL` / `자체 발매` | 레코드 레이블·퍼블리셔 |
| `engineer` | 자유 텍스트 | `Studio NOL (황경하)` | 믹싱·레코딩 엔지니어 |
| `musicians` | `이름 \| 이름 \| 이름` | `김가수 (Vocal) \| 박연주 (Guitar)` | **`\|`로 구분** (쉼표 아님) |
| `gear` | `장비 \| 장비` | `Neumann U87 \| Neve 1073 \| Tube-Tech CL1B` | **`\|`로 구분** |

### 주의사항

- **쉼표(`,`)는 CSV 셀 구분자**이므로, 값 안에서 쉼표를 쓰려면 큰따옴표로 감싸야 합니다.
  - 좋은 예: `"Vocal, Guitar, Piano"` (한 사람이 여러 파트 연주)
  - 더 좋은 예: `Vocal | Guitar | Piano` (공백 포함 `|` 사용, CSV 쉼표 혼동 없음)
- **한국어 `<>`는 그대로 둬도 됨** — CSV 인용 필요 없음.
- **빈 칸 = "모름"**. 현재 값 유지. 의도적으로 기존 값을 지우려면 이 도구가 아닌 직접 `data/portfolio.ts`를 수정.

## 참고용: 현재 값이 채워진 11개 아이템

스크립트가 이미 채워져 있는 아래 아이템들의 스타일을 참고하세요:

- `the-projectors-babu-first-flight`
- `unknown-feeling`
- `dystopia-2025`
- `jai-golden-hour`
- `heo-jeong-hyuk-wind`
- `peace-and-music`
- `hwang-gyeong-ha-nunnokeut`
- `namjae-wi-inmul`
- `various-artists-fish-die`
- `balkwaehan-cm-song`
- `various-artists-gentrification`

## 스크립트 동작 규칙

- **빈 CSV 셀은 무시** — 해당 필드는 `data/portfolio.ts`의 기존 값 그대로.
- **값이 있으면 upsert** — 기존에 없던 필드는 추가, 있던 필드는 교체.
- **`credits`는 3개 서브필드 중 하나라도 있으면 블록 생성** — engineer/musicians/gear 중 일부만 채워도 OK.
- **dry-run 우선** — 항상 `--dry-run`으로 변경 내역을 먼저 확인.

## SEO 관점에서의 효과

메타데이터가 채워지면 다음과 같이 작동합니다:

1. **MusicRecording JSON-LD 풍부화** — Google이 리치 리절트 후보로 인식.
2. **페이지 본문 양 증가** — credits 테이블 렌더로 thin content 임계값 여유 확보.
3. **allocation 신호 개선** — 명확한 발매일·레이블로 Google이 콘텐츠 신선도·권위 판단에 활용.

현재 34개 포트폴리오 중 11개만 리치 메타를 보유 → 23개 보강 시 **모든 포트폴리오가 풀-리치 색인 후보**가 됩니다.
