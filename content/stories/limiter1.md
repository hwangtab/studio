---
title: "리미터 완전 가이드 — 마스터링 리미터 설정과 스트리밍 음압 확보"
date: 2026-04-06
author: "스튜디오 놀"
category: "녹음 가이드"
tags: ["리미터", "limiter", "마스터링 리미터", "트루피크", "LUFS", "음압 확보", "스트리밍 마스터링"]
thumbnail: "/images/service3.webp"
summary: "마스터링 리미터 완전 가이드. 리미터와 컴프레서의 차이, True Peak 설정, 스트리밍 플랫폼 LUFS 기준, 추천 리미터 플러그인까지 마스터링 마지막 단계를 완벽히 안내합니다."
faq:
  - q: "리미터와 컴프레서는 어떻게 다른가요?"
    a: "컴프레서는 Ratio를 2:1~8:1 정도로 설정해 다이나믹을 부드럽게 줄이고, 리미터는 Ratio를 무한대(∞:1)로 설정해 설정한 천장(Ceiling) 이상으로 신호가 절대 넘어가지 않게 막습니다. 마스터링 마지막 단계에서 음압을 최대화할 때 사용합니다."
  - q: "True Peak -1dBFS는 왜 지켜야 하나요?"
    a: "스트리밍 플랫폼(스포티파이, 애플뮤직, 유튜브)에서 음원을 디코딩할 때 실제 피크가 0dBFS를 초과하면 찌그러짐이 발생할 수 있습니다. -1dBFS True Peak는 이 여유를 확보하는 업계 표준입니다."
  - q: "스포티파이와 유튜브의 LUFS 기준은 다른가요?"
    a: "스포티파이: -14 LUFS, 유튜브: -14 LUFS, 애플뮤직: -16 LUFS, 사운드클라우드: -8~-12 LUFS가 기준입니다. 너무 크게 마스터링하면 플랫폼에서 자동으로 음량을 낮추므로 -14 LUFS를 목표로 하는 것이 일반적입니다."
  - q: "추천 리미터 플러그인은 무엇인가요?"
    a: "무료: TDR Limiter 6 GE (데모), Limiter No6. 유료: FabFilter Pro-L2, iZotope Ozone Maximizer, Waves L2. 입문자에게는 FabFilter Pro-L2가 시각적 피드백이 직관적이어서 추천합니다."
---
![리미터 완전 가이드 — 스튜디오 놀](/images/service3.webp)

## 마스터링의 마지막 문지기

리미터는 마스터링 체인의 마지막에 위치해 음원이 디지털 천장(0dBFS)을 넘지 않도록 막고, 스트리밍 플랫폼에 적합한 음압을 확보합니다.

---

## 리미터 기본 파라미터

| 파라미터 | 역할 | 마스터링 권장값 |
|--------|------|------------|
| Input Gain / Drive | 리미터에 들어가는 신호 레벨 | 원하는 LUFS 목표에 맞게 올리기 |
| Ceiling (출력 상한) | 신호가 절대 넘지 않을 최대 레벨 | -1.0dBFS (True Peak) |
| Lookahead | 미래 신호를 미리 보고 반응 | 1~3ms |
| Release | 리미팅 후 신호 회복 속도 | 100~300ms (장르에 따라) |

---

## 스트리밍 플랫폼별 음압 기준

버스로 묶어 처리하면 개별 트랙 조정 없이도 전체 밸런스를 효율적으로 잡을 수 있습니다.

### 플랫폼별 타겟 LUFS

- **스포티파이**: -14 LUFS (Integrated)
- **유튜브**: -14 LUFS
- **애플뮤직/아이튠즈**: -16 LUFS
- **타이달(Tidal)**: -14 LUFS
- **사운드클라우드**: 권장 -8~-12 LUFS

### True Peak 기준

- **모든 플랫폼 공통**: -1.0dBFS True Peak 이하

### 전략

- -14 LUFS를 목표로 마스터링 시 대부분 플랫폼에서
  음압이 낮춰지지 않음
- -8 LUFS 이상으로 올리면 플랫폼에서 -14로 자동 낮춤
  - 결과적으로 음질만 손해

---

## 마스터링 리미터 설정 절차

같은 플러그인이라도 신호 체인의 어느 위치에 두느냐에 따라 결과가 크게 달라집니다.

### 단계별 설정

1. 리미터 앞 EQ, 컴프레서, 새추레이션 등 처리 완료
2. 리미터 Ceiling: -1.0dBFS (True Peak) 설정
3. Input Gain을 천천히 올리면서 LUFS 미터 확인
  - **타겟**: -14 LUFS (Integrated)
4. Gain Reduction (GR) 확인
   - GR -3dB 이하: 음원이 이미 충분히 조용함 (정상)
   - GR -6~-10dB: 큰 피크 처리 중 (적절)
   - GR -15dB 이상: 너무 과도한 리미팅 → 믹스 재검토

5. Loudness Meter로 최종 확인
   - Integrated LUFS: -14 (스포티파이 기준)
   - True Peak: -1.0dBFS 이하
   - Short-term/Momentary LUFS도 참고

---

## 리미터 추천 플러그인

| 플러그인 | 특징 | 가격대 |
|--------|------|------|
| FabFilter Pro-L2 | 직관적 UI, True Peak 정확 | 유료 |
| iZotope Ozone Maximizer | AI 어시스턴트 포함 | 유료 |
| Waves L2 | 업계 표준, 안정적 | 유료 |
| TDR Limiter 6 GE | 투명한 리미팅 | 유료(데모 무료) |
| Limiter No6 | 무료, 멀티스테이지 | 무료 |

---

## 마치며

리미터 설정은 마스터링의 마지막 단계이지만, 그 전 믹싱과 마스터링 처리가 잘 돼 있어야 리미터도 제 역할을 합니다.

---

[스템 마스터링 완전 가이드](/stories/stem-mastering1) | [마스터링 완전 가이드](/stories/mastering1) | [음압(LUFS) 스트리밍 마스터링 가이드](/stories/loudness1) | [게인 스테이징 완전 가이드](/stories/gain-staging1) | [피아노 리듬감·리듬 훈련 음악연습실](/stories/practice-room-piano-rhythm1) | [기타 트레몰로·웜바 암 테크닉 음악연습실](/stories/practice-room-guitar-whammy1) | [보컬 다이나믹스·크레셴도 데크레셴도 음악연습실](/stories/practice-room-vocal-dynamics1) | [기타 줄 교체·스트링 선택 음악연습실](/stories/practice-room-guitar-string1) | [드럼 브러쉬·와이어 브러쉬 연주 음악연습실](/stories/practice-room-drum-brush1) | [피아노 즉흥 반주·코드 반주 음악연습실](/stories/practice-room-piano-sight-play1) | [베이스 코드·화음 연주 음악연습실](/stories/practice-room-bass-chord1) | [보컬 팔세토·가성 발성 음악연습실](/stories/practice-room-vocal-falsetto1) | [기타 탭핑·투핸드 태핑 음악연습실](/stories/practice-room-guitar-tapping1) | [피아노 듀엣·앙상블 개인 연습 음악연습실](/stories/practice-room-piano-duet1) | [드럼 폴리리듬·복잡박자 연습 음악연습실](/stories/practice-room-drum-polyrhythm1) | [보컬 어질리티·빠른 음계 훈련 음악연습실](/stories/practice-room-vocal-agility1) | [재즈 피아노 즉흥 솔로·임프로비제이션 음악연습실](/stories/practice-room-piano-jazz-improv1) | [기타 레가토·해머온 풀오프 연습 음악연습실](/stories/practice-room-guitar-legato1) | [베이스 펑크·R&B 그루브 음악연습실](/stories/practice-room-bass-funk1) | [보컬 프로젝션·소리 울림 훈련 음악연습실](/stories/practice-room-vocal-projection1) | [피아노 옥타브·넓은 음정 도약 연습 음악연습실](/stories/practice-room-piano-technique31) | [기타 슬라이드·슬라이드 기타 연습 음악연습실](/stories/practice-room-guitar-slide1) | [보컬 스타일 개발·장르별 창법 음악연습실](/stories/practice-room-vocal-style1) | [통기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-acoustic-fingerpick1) | [드럼 하이햇·심벌 컨트롤 음악연습실](/stories/practice-room-drum-hihat1) | [피아노 트릴·장식음 기법 음악연습실](/stories/practice-room-piano-trills1) | [기타 코드 진행·화성 이해 음악연습실](/stories/practice-room-guitar-chord-prog1) | [장르별 보컬 특성·크로스오버 보컬 음악연습실](/stories/practice-room-vocal-genre1) | [베이스 썸피킹·핑거스타일 혼합 음악연습실](/stories/practice-room-bass-thumb1) | [피아노 발라드 반주·감성 피아노 음악연습실](/stories/practice-room-piano-ballad21) | [기타 아르페지오·분산 화음 연습 음악연습실](/stories/practice-room-guitar-arpeggio1) | [보컬 녹음 준비·레코딩 보컬 음악연습실](/stories/practice-room-vocal-recording1) | [가스펠·CCM 피아노 반주 음악연습실](/stories/practice-room-piano-gospel1) | [기타 핑거스타일 고급·솔로 기타 편곡 음악연습실](/stories/practice-room-guitar-fingerpick-adv1) | [드럼 킥·베이스 드럼 테크닉 음악연습실](/stories/practice-room-drum-kick1) | [보컬 벨팅·파워 벨팅 음악연습실](/stories/practice-room-vocal-belting1) | [피아노 컴핑·재즈 반주 패턴 음악연습실](/stories/practice-room-piano-comping1) | [기타 피치카토·뮤트 주법 음악연습실](/stories/practice-room-guitar-mute1) | [베이스 핑거링·오른손 테크닉 음악연습실](/stories/practice-room-bass-fingering1) | [보컬 스타카토·단음 발성 훈련 음악연습실](/stories/practice-room-vocal-staccato1) | [연신내 음악연습실 안내](/stories/practice-room-yeonsinnae1) | [스튜디오 놀 이용 요금](/pricing)
