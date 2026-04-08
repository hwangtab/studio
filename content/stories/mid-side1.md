---
title: "미드사이드(Mid-Side) 처리 완전 가이드 — 스테레오 폭 정밀 조절"
date: 2026-04-07
author: "스튜디오 놀"
category: "음반 제작 가이드"
tags: ["미드사이드", "MS 처리", "MS EQ", "스테레오 폭", "모노 호환성", "마스터링 고급", "스테레오 이미징"]
thumbnail: "/images/recording14.webp"
summary: "미드사이드(MS) 처리 완전 가이드입니다. Mid-Side 신호 원리, MS EQ로 스테레오 폭 조절, MS 컴프레서 활용, 마스터링에서의 MS 활용, 모노 호환성 체크를 정리합니다."
faq:
  - q: "미드사이드(Mid-Side) 처리란 무엇인가요?"
    a: "스테레오 신호를 Mid(좌우 공통 신호)와 Side(좌우 차이 신호)로 분리하여 독립적으로 처리하는 기법입니다. Mid는 모노 호환 신호, Side는 스테레오 폭을 담당합니다."
  - q: "MS EQ로 무엇을 할 수 있나요?"
    a: "Mid 채널 EQ로 모노 요소(보컬·킥·베이스)의 음색을 조정하고, Side 채널 EQ로 스테레오 요소(패드·리버브·스테레오 기타)의 폭과 밝기를 독립적으로 조절할 수 있습니다."
  - q: "모노 호환성이란 무엇이고 왜 중요한가요?"
    a: "스피커 1개(모노)에서 재생할 때도 음악이 자연스럽게 들려야 한다는 개념입니다. Side 신호가 너무 강하면 모노로 재생 시 음이 사라지거나 위상 문제가 발생합니다. 특히 클럽·라디오·스마트폰 스피커에서 중요합니다."
  - q: "스테레오 폭을 넓히는 게 항상 좋은가요?"
    a: "아닙니다. 스테레오 폭이 지나치면 모노 호환성이 떨어지고 믹스가 불안정해집니다. 보컬과 저음 악기는 Mid(모노)로 유지하고, 패드·이펙트는 Side(스테레오)로 넓히는 것이 균형 잡힌 접근입니다."
---
![미드사이드(Mid-Side) 처리 완전 가이드 — 스튜디오 놀](/images/recording14.webp)

## Mid-Side — 스테레오를 해부하는 고급 기법

MS 처리는 스테레오 믹스를 모노와 스테레오 성분으로 분리하여 더 정밀하게 제어하는 마스터링·믹싱 고급 기법입니다.

---

## Mid-Side 신호 원리

| 채널 | 신호 구성 | 담당 요소 |
|------|-----------|-----------|
| Mid | (L+R) / 2 (모노 합산) | 보컬·킥·베이스·센터 악기 |
| Side | (L-R) / 2 (좌우 차이) | 패드·리버브·스테레오 악기·공간감 |

---

## MS EQ 활용

기본값에서 출발해 한 번에 하나씩 조절하면 각 파라미터의 역할이 명확하게 들립니다.

### Mid 채널 EQ

- 보컬 명료도 조정 (2~5kHz)
- 킥·베이스 저역 정리 (80~200Hz)
- 전체 중역 균형 조정
- Mid 변화는 모노 호환성에 직접 영향

### Side 채널 EQ

- 고역 에어 추가 (10kHz 이상 Shelf +1~2dB)
  - 스테레오 밝기와 공간감 향상
- 저역 컷 (HPF 80~100Hz)
  - 모노 저역 보호 (스테레오 저역 위상 문제 방지)
- 과도한 주파수 억제

### 기본 MS EQ 세팅

**Mid**
- HPF: 30~40Hz
- 200~400Hz: 공명 제거 (서지컬)
- 2~5kHz: 명료도 미세 조정

**Side**
- HPF: 80~100Hz (반드시 컷)
- 10kHz 이상 Shelf: +1~2dB (에어감)
- 4~8kHz: 시빌런스 확인 후 필요시 컷

---

## MS 컴프레서 활용

모노로 확인하면 스테레오에서 감춰진 문제를 더 빨리 발견할 수 있습니다.

### Mid 컴프레서

- 보컬·킥 다이나믹 균일화
- Ratio: 2:1~3:1 (자연스럽게)
- GR: -2~-4dB

### Side 컴프레서

- 스테레오 성분 다이나믹 제어
- 과도한 스테레오 폭 제한
- Ratio: 1.5:1~2:1 (더 부드럽게)
- GR: -1~-2dB (Side 과압축 금지)

### 주의사항

- Side 과압축 → 스테레오 폭 과도 축소
- 항상 모노 체크로 위상 문제 확인

---

## 스테레오 폭 조절

바이패스로 전후 비교하는 습관이 과처리를 막는 가장 효과적인 방법입니다.

### 폭 좁히기 (모노 호환성 향상)

- Side 채널 레벨 감소 (-3dB ~ -6dB)
- 또는 MS 플러그인 Width 파라미터 감소

### 폭 넓히기 (공간감 강화)

- Side 채널 레벨 증가 (+1dB ~ +3dB)
- 과도하면 모노 호환성 저하 → 최대 +3dB 이내

### Mid 강화 (보컬·저음 집중)

- Mid 채널 레벨 소폭 증가
- 보컬·킥·베이스 안정성 향상

---

## 모노 호환성 체크

아래 설정값은 출발점이며, 곡의 장르와 보컬 특성에 따라 조정이 필요합니다.

### 체크 방법

1. DAW 마스터버스에 모노 버튼 활성화
2. 모노 재생 시 음이 사라지지 않는지 확인
3. 보컬·킥·베이스 레벨 변화 없어야 정상
4. Side 감소 시 문제 해결 가능

### 문제 발생 원인

- 과도한 스테레오 스프레드 플러그인
- 위상 반전된 스테레오 요소
- 너무 넓은 스테레오 리버브

### 권장 도구

- Mono 버튼: Logic·Ableton·Pro Tools 내장
- SPAN (무료): 스펙트럼·스테레오 폭 시각화

---

## 마치며

MS 처리는 마스터링의 정밀도를 한 단계 높이는 고급 기법입니다.

---

[오디오 위상 완전 가이드](/stories/phase1) | [멀티밴드 컴프레서 완전 가이드](/stories/multiband1) | [스테레오 이미징 완전 가이드](/stories/stereo-imaging1) | [마스터링 완전 가이드](/stories/mastering1) | [온라인 믹싱 의뢰 방법](/stories/onlinemix1) | [피아노 리듬감·리듬 훈련 음악연습실](/stories/practice-room-piano-rhythm1) | [기타 트레몰로·웜바 암 테크닉 음악연습실](/stories/practice-room-guitar-whammy1) | [보컬 다이나믹스·크레셴도 데크레셴도 음악연습실](/stories/practice-room-vocal-dynamics1) | [기타 줄 교체·스트링 선택 음악연습실](/stories/practice-room-guitar-string1) | [드럼 브러쉬·와이어 브러쉬 연주 음악연습실](/stories/practice-room-drum-brush1) | [피아노 즉흥 반주·코드 반주 음악연습실](/stories/practice-room-piano-sight-play1) | [베이스 코드·화음 연주 음악연습실](/stories/practice-room-bass-chord1) | [보컬 팔세토·가성 발성 음악연습실](/stories/practice-room-vocal-falsetto1) | [기타 탭핑·투핸드 태핑 음악연습실](/stories/practice-room-guitar-tapping1) | [피아노 듀엣·앙상블 개인 연습 음악연습실](/stories/practice-room-piano-duet1) | [드럼 폴리리듬·복잡박자 연습 음악연습실](/stories/practice-room-drum-polyrhythm1) | [보컬 어질리티·빠른 음계 훈련 음악연습실](/stories/practice-room-vocal-agility1) | [재즈 피아노 즉흥 솔로·임프로비제이션 음악연습실](/stories/practice-room-piano-jazz-improv1) | [기타 레가토·해머온 풀오프 연습 음악연습실](/stories/practice-room-guitar-legato1) | [베이스 펑크·R&B 그루브 음악연습실](/stories/practice-room-bass-funk1) | [보컬 프로젝션·소리 울림 훈련 음악연습실](/stories/practice-room-vocal-projection1) | [피아노 옥타브·넓은 음정 도약 연습 음악연습실](/stories/practice-room-piano-technique31) | [기타 슬라이드·슬라이드 기타 연습 음악연습실](/stories/practice-room-guitar-slide1) | [보컬 스타일 개발·장르별 창법 음악연습실](/stories/practice-room-vocal-style1) | [통기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-acoustic-fingerpick1) | [드럼 하이햇·심벌 컨트롤 음악연습실](/stories/practice-room-drum-hihat1) | [피아노 트릴·장식음 기법 음악연습실](/stories/practice-room-piano-trills1) | [기타 코드 진행·화성 이해 음악연습실](/stories/practice-room-guitar-chord-prog1) | [장르별 보컬 특성·크로스오버 보컬 음악연습실](/stories/practice-room-vocal-genre1) | [연신내 음악연습실 안내](/stories/practice-room-yeonsinnae1) | [스튜디오 놀 이용 요금](/pricing)
