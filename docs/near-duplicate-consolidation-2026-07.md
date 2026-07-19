# 근접중복 통합 실행 기록 — 2026-07-18

> [near-duplicate-scan-2026-07.md](near-duplicate-scan-2026-07.md)(스캔) → 이 문서(실행).
> [story-content-strategy-2026-07.md](story-content-strategy-2026-07.md) P1 근접중복 통합 항목의 실행 기록.

## 핵심 판단 — 501개 페어의 대부분은 "중복 URL"이 아니라 "템플릿 스핀"이다

스캔이 검출한 J≥0.45 비지역 페어 501건의 절대다수는 **practice-room 악기 계열(594편, 전체 41%)이 같은 본문 템플릿을 공유**해서 나온 것이다. 예: `piano-key-signature1`(조표)와 `piano-left-hand1`(왼손)는 본문 J=0.695지만 **검색 의도가 다른 별개 주제**다. 이들을 페어 단위로 308 통합하면 롱테일 의도 커버리지를 파괴한다.

→ **결론: 이 대량 유사도는 308(중복 URL 통합) 대상이 아니라 탈템플릿화·꼬리정리 트랙 사안이다.**
- **탈템플릿화**: 색인·트래픽 있는 practice-room 페이지의 공통 스캐폴딩을 페이지 고유 내용으로 교체(본문 차별화). J를 낮추는 정공법.
- **꼬리정리**: 트래픽 0·NOINDEX_CANDIDATE인 practice-room 페이지는 단계적 noindex(대량 발행 자산의 자연스러운 정리).
- 스캔 리포트 자체 권고와 일치: "템플릿 클러스터(practice-room 계열)는 페어 단위 308이 아니라 클러스터 단위 전략(대표 페이지 통합 또는 본문 차별화) 판단이 선행돼야 한다."

## 실제 308 통합 대상 — 명백한 동의어 슬러그 4쌍만

"슬러그 자체가 같은 주제의 철자/약어 변형"이고, 각 페어에서 canonical 방향이 GSC 강자와 일치하며, 약자 쪽이 저·무트래픽인 페어만 통합했다(album-art1 선례와 동일 원칙).

| 약자 (→308) | canonical (유지) | 근거 | GSC (약자 → canonical) |
|---|---|---|---|
| `practice-room-vocal-warmup1` | `practice-room-vocal-warm-up1` | 같은 단어(warm-up=warmup), 본문 J=0.715 | 0/39 → 0/62 (노출 우위) |
| `practice-room-guitar-scale-position1` | `practice-room-guitar-scale-pos1` | pos=position 약어, 같은 주제 | 0/20 WATCH → 1/22 KEEP |
| `practice-room-guitar-fingerpick-adv1` | `practice-room-guitar-fingerstyle-adv1` | 핑거픽=핑거스타일 동의어 | 0/0 NOINDEX_CAND → 1/18 KEEP |
| `practice-room-guitar-jazz-chord1` | `practice-room-guitar-jazz-voicing1` | title sim 0.86, 같은 주제 | 0/0 NOINDEX_CAND → 1/24 KEEP |

**제외한 경계 페어**(부차 의도 상이 → 통합 안 함, 각자 트래픽 보유):
- `guitar-sweep-picking1` / `guitar-sweep1` — 스윕 vs 이코노미 피킹(부차 의도 다름)
- `guitar-finger-vibrato1` / `guitar-vibrato1` — 둘 다 KEEP·트래픽 보유
- `drum-rimshot-adv1` / `drum-rimshot1` — 기초 vs 고급 의도적 분할

## 실행 내용 (album-art1 선례 준수)

1. **`lib/regionRedirectMap.json`에 4개 등재** → middleware 308 + 사이트맵 `REDIRECTED_SLUGS` 자동 제외.
2. **본문 링크 16곳 갱신**(308 홉 방지):
   - 교차링크 12곳: 약자 URL → canonical로 스왑.
   - canonical 파일 4곳: 자기 약자 트윈을 가리키던 관련글 첫 세그먼트 제거(자기링크 방지, 관련글 4개 잔존).
3. **`data/practiceRoomRelatedGuides.ts`에서 약자 4줄 제거**(canonical은 이미 목록에 존재 → 관련가이드 커버리지 손실 없음).
4. 잔여 약자 참조 0건 확인. `lib/story-catalog.json`(gsc-audit용 빌드 산출물)은 prebuild에서 재생성되며 리스팅은 런타임 `getAllStories`가 리다이렉트를 거르므로 손대지 않음(album-art1과 동일).

## 후속

- **탈템플릿화 대상 1순위**: practice-room 계열 중 색인·트래픽 있는 페이지(예: `piano-tremolo1` 4/127, `drum-offbeat1` 1/90, `bass-detuning1` 5/102, `guitar-blues-scale1` 2/100)의 본문 차별화. F15 플래그십 업그레이드와 별개 배치.
- **꼬리정리 대상**: practice-room 계열 NOINDEX_CANDIDATE(트래픽 0) 단계적 noindex — 전체 688 꼬리 정리 일정에 포함.
- **광역 허브 `jeonbuk1`/`jeonnam1`(J=0.452)**: 308 불가(허브), 본문 차별화 대상.
- **cover 계열**: 본문 중복 무혐의(최고 J=0.134). 통합 논의 불요, 필요 시 GSC 쿼리 카니벌라이제이션으로 별도 판단.
