---
title: "마스터링 체인 완전 가이드 — 스트리밍 시대의 마스터링 신호 체인"
date: 2026-04-07
author: "스튜디오 놀"
category: "음반 제작 가이드"
tags: ["마스터링 체인", "마스터링 신호 체인", "마스터링 EQ", "마스터링 컴프레서", "마스터링 리미터", "LUFS 마스터링", "스트리밍 마스터링"]
thumbnail: "/images/hardware2.webp"
summary: "마스터링 체인 완전 가이드입니다. 스트리밍 시대 마스터링 신호 체인 구성, EQ·컴프레서·스테레오 이미저·리미터 순서, LUFS 목표치, 마스터링 플러그인 비교를 정리합니다."
faq:
  - q: "마스터링 신호 체인의 기본 순서는?"
    a: "일반적으로 EQ → 컴프레서(SSL G-Bus 또는 1176) → 스테레오 이미저 → EQ(최종) → 리미터 순서입니다. 새추레이션을 사용하는 경우 컴프레서 전후에 배치하기도 합니다."
  - q: "스트리밍 마스터링 LUFS 목표치는?"
    a: "Spotify와 Apple Music은 -14 LUFS Integrated를 권장합니다. 클럽·EDM은 -10 LUFS까지 허용합니다. True Peak는 -1dBTP 이하를 유지해야 스트리밍 플랫폼의 라우드니스 노멀라이제이션에서 클리핑이 발생하지 않습니다."
  - q: "마스터링에서 리미터만 사용하면 안 되나요?"
    a: "리미터만으로도 기본 마스터링이 가능하지만, 최상의 결과를 위해서는 EQ와 컴프레서로 음색과 다이나믹을 먼저 정교하게 처리한 후 리미터로 최종 음압을 설정하는 것이 좋습니다."
  - q: "마스터링 리미터로 어떤 플러그인이 좋은가요?"
    a: "FabFilter Pro-L 2, iZotope Ozone Maximizer, Waves L3-LL Multimaximizer, Sonnox Oxford Limiter가 대표적입니다. FabFilter Pro-L 2는 투명한 리미팅과 LUFS 미터 내장으로 업계 표준으로 사용됩니다."
---
![마스터링 체인 완전 가이드 — 스튜디오 놀](/images/hardware2.webp)

## 마스터링 체인 — 최종 사운드를 완성하다

마스터링은 믹스된 스테레오 파일을 스트리밍·배포에 최적화하는 최종 단계입니다.

---

## 마스터링 신호 체인 순서

작은 조정이 전체 믹스 밸런스에 예상보다 큰 영향을 줄 수 있으니 단계적으로 적용하세요.

### 기본 마스터링 체인

1. EQ (Linear Phase) — 저역/고역 정리
2. 컴프레서 (SSL G-Bus 또는 1176) — 다이나믹 제어
3. 새추레이션 (선택) — 하모닉 질감
4. 스테레오 이미저 (선택) — 스테레오 폭 조정
5. EQ (최종 음색 조정)
6. 리미터 — 최종 음압·True Peak 제한

### 간소화된 마스터링 체인

1. EQ (Linear Phase)
2. 멀티밴드 컴프레서
3. 리미터

---

## 마스터링 EQ

고음역 컷이 전체 믹스에 투명감을 더해주는 경우가 많으므로 저역부터 정리하세요.

### 마스터링 EQ 설정

- Linear Phase 모드 사용 (위상 왜곡 없음)
- HPF: 20~30Hz (극저역 노이즈 제거)
- Low Shelf: 필요 시 ±1~2dB
- High Shelf: 10kHz+ 약간 부스트 (에어)
- 협대역 컷은 최대한 자제

### 주의사항

마스터링 EQ는 믹스를 고치는 도구가 아님.
각 대역 ±2~3dB 이상의 과도한 처리는
믹스 재수정이 필요한 신호

---

## 마스터링 컴프레서

아래 설정값은 출발점이며, 곡의 장르와 보컬 특성에 따라 조정이 필요합니다.

### SSL G-Bus 스타일 마스터링 컴프레션

- Ratio: 2:1 (부드러운 Glue)
- Attack: 30ms (트랜지언트 보존)
- Release: Auto
- GR: -1~-2dB (매우 적은 컴프레션)

### 1176 스타일 마스터링 컴프레션

- Ratio: 4:1
- Attack: 3~5 (중간)
- GR: -1~-2dB

### 주의사항

마스터링 컴프레서는 믹스를 형성하는 것이 목적.
GR -1~-3dB 이내가 일반적.
과도한 컴프레션 → 펌핑·다이나믹 손실

---

## 스테레오 이미저

플러그인을 추가하기 전에 게인 스테이징이 올바른지 먼저 확인합니다.

### 스테레오 이미지 처리

- 저역(80Hz 이하): 모노 처리 필수
  (저역 스테레오는 모노 재생 시 상쇄)
- 중역: 원래 폭 유지
- 고역(10kHz+): 약간 확산 가능

### Mid/Side EQ 활용

- Side 채널 고역 약간 부스트: 넓은 스테레오
- Side 채널 저역 컷: 모노 호환성 향상

---

## 리미터 & LUFS 목표치

이펙트를 추가하기 전에 원음의 문제를 먼저 해결하는 것이 올바른 순서입니다.

### 스트리밍 LUFS 목표

- Spotify: -14 LUFS (라우드니스 노멀라이제이션)
- Apple Music: -16 LUFS (Mastered for iTunes)
- YouTube: -14 LUFS
- 클럽/EDM: -10~-8 LUFS
- True Peak: 반드시 -1dBTP 이하

### 리미터 설정

- Output Ceiling: -0.5~-1dBTP
- 리미팅 양: GR -1~-4dB (장르에 따라)
- 투명한 리미터: FabFilter Pro-L 2

---

## 마스터링 플러그인 비교

버스로 묶어 처리하면 개별 트랙 조정 없이도 전체 밸런스를 효율적으로 잡을 수 있습니다.

### 주요 마스터링 플러그인

**iZotope Ozone 11**
- 올인원 마스터링 슈트
- AI 마스터링 어시스턴트
- EQ·컴프레서·임에저·리미터 통합

FabFilter Pro-Q3 + Pro-C2 + Pro-L2:
- 분리된 고품질 모듈 조합
- 정밀한 마스터링 제어

Waves Abbey Road TG Mastering Chain:
- Abbey Road Studios 마스터링 콘솔 에뮬레이션
- 빈티지 마스터링 질감

**Sonnox Oxford suite**
- 방송·클래식 마스터링 표준

---

## 마치며

마스터링 체인은 EQ·컴프레서·리미터의 순차적 처리로 믹스를 스트리밍에 최적화합니다.

---

[스트리밍 음악 출시 완전 가이드](/stories/streaming-release1) | [SSL G-Bus 컴프레서 완전 가이드](/stories/ssl-bus1) | [FabFilter Pro-Q3 완전 가이드](/stories/fabfilter1) | [스템 마스터링 완전 가이드](/stories/stem-mastering1) | [온라인 믹싱 의뢰 방법](/stories/onlinemix1) | [피아노 리듬감·리듬 훈련 음악연습실](/stories/practice-room-piano-rhythm1) | [기타 트레몰로·웜바 암 테크닉 음악연습실](/stories/practice-room-guitar-whammy1) | [보컬 다이나믹스·크레셴도 데크레셴도 음악연습실](/stories/practice-room-vocal-dynamics1) | [기타 줄 교체·스트링 선택 음악연습실](/stories/practice-room-guitar-string1) | [드럼 브러쉬·와이어 브러쉬 연주 음악연습실](/stories/practice-room-drum-brush1) | [피아노 즉흥 반주·코드 반주 음악연습실](/stories/practice-room-piano-sight-play1) | [베이스 코드·화음 연주 음악연습실](/stories/practice-room-bass-chord1) | [보컬 팔세토·가성 발성 음악연습실](/stories/practice-room-vocal-falsetto1) | [기타 탭핑·투핸드 태핑 음악연습실](/stories/practice-room-guitar-tapping1) | [피아노 듀엣·앙상블 개인 연습 음악연습실](/stories/practice-room-piano-duet1) | [드럼 폴리리듬·복잡박자 연습 음악연습실](/stories/practice-room-drum-polyrhythm1) | [보컬 어질리티·빠른 음계 훈련 음악연습실](/stories/practice-room-vocal-agility1) | [재즈 피아노 즉흥 솔로·임프로비제이션 음악연습실](/stories/practice-room-piano-jazz-improv1) | [기타 레가토·해머온 풀오프 연습 음악연습실](/stories/practice-room-guitar-legato1) | [베이스 펑크·R&B 그루브 음악연습실](/stories/practice-room-bass-funk1) | [보컬 프로젝션·소리 울림 훈련 음악연습실](/stories/practice-room-vocal-projection1) | [피아노 옥타브·넓은 음정 도약 연습 음악연습실](/stories/practice-room-piano-technique31) | [기타 슬라이드·슬라이드 기타 연습 음악연습실](/stories/practice-room-guitar-slide1) | [보컬 스타일 개발·장르별 창법 음악연습실](/stories/practice-room-vocal-style1) | [통기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-acoustic-fingerpick1) | [드럼 하이햇·심벌 컨트롤 음악연습실](/stories/practice-room-drum-hihat1) | [피아노 트릴·장식음 기법 음악연습실](/stories/practice-room-piano-trills1) | [기타 코드 진행·화성 이해 음악연습실](/stories/practice-room-guitar-chord-prog1) | [장르별 보컬 특성·크로스오버 보컬 음악연습실](/stories/practice-room-vocal-genre1) | [연신내 음악연습실 안내](/stories/practice-room-yeonsinnae1) | [스튜디오 놀 이용 요금](/pricing)
