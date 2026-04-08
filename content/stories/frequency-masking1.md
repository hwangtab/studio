---
title: "주파수 마스킹 완전 가이드 — 악기 간 공간 분리와 보컬 명료도"
date: 2026-04-07
author: "스튜디오 놀"
category: "음반 제작 가이드"
tags: ["주파수 마스킹", "주파수 충돌", "보컬 명료도", "악기 공간 분리", "EQ 마스킹", "믹싱 공간", "중역대 정리"]
thumbnail: "/images/room2.webp"
summary: "주파수 마스킹 완전 가이드입니다. 마스킹 발생 원인, 보컬-악기 주파수 충돌 식별, EQ 카빙으로 마스킹 해결, 악기별 주파수 공간 배분 전략을 정리합니다."
faq:
  - q: "주파수 마스킹이란 무엇인가요?"
    a: "두 개 이상의 소리가 같은 주파수 대역에서 겹칠 때, 에너지가 강한 소리가 약한 소리를 덮어 들리지 않게 만드는 현상입니다. 믹스에서 보컬이 기타에 묻히거나, 베이스가 킥 드럼과 충돌하는 것이 대표적입니다."
  - q: "보컬 명료도가 낮은 이유가 주파수 마스킹 때문인가요?"
    a: "보컬이 묻히는 주원인 중 하나입니다. 보컬 중역대(500Hz~3kHz)와 같은 영역에 기타·피아노·오르간이 가득 차면 보컬이 마스킹됩니다. EQ 카빙으로 악기 중역을 줄이면 보컬 공간이 확보됩니다."
  - q: "EQ 카빙이란 무엇인가요?"
    a: "다른 악기 트랙의 EQ에서 보컬이 존재하는 주파수 대역을 부드럽게 감소(컷)시켜 보컬이 앉을 공간을 만드는 기법입니다. 보컬 EQ를 높이는 것보다 다른 악기를 줄이는 것이 더 자연스럽습니다."
  - q: "악기별 고유 주파수 공간은 어떻게 배분하나요?"
    a: "킥 드럼(50~100Hz)·베이스(80~250Hz)는 저역, 스네어(200~300Hz), 기타(250Hz~5kHz), 보컬(500Hz~3kHz)은 중역, 심벌(8kHz~)은 고역으로 겹치지 않도록 EQ로 배분합니다."
---
![주파수 마스킹 완전 가이드 — 스튜디오 놀](/images/room2.webp)

## 주파수 마스킹 — 소리가 소리를 가리는 현상

믹스에서 모든 악기가 선명하게 들리려면 각 악기가 고유한 주파수 공간을 가져야 합니다.

---

## 주요 마스킹 충돌 구간

| 충돌 쌍 | 충돌 주파수 | 해결 우선순위 |
|---------|-------------|--------------|
| 킥 드럼 vs 베이스 | 60~120Hz | 저역 → 킥 공간 확보 |
| 보컬 vs 기타 | 500Hz~3kHz | 중역 → 보컬 우선 |
| 보컬 vs 피아노 | 800Hz~2kHz | 중역 → 보컬 우선 |
| 스네어 vs 보컬 | 200~400Hz | 보컬 저중역 컷 |
| 심벌 vs 보컬 | 5kHz~8kHz | 보컬 고역 Di-esser |

---

## 마스킹 문제 식별 방법

레퍼런스 트랙과 A/B 비교하면서 조절하면 과보정을 방지할 수 있습니다.

### 청취 체크

1. 믹스 전체 재생 시 보컬이 묻히는 구간 확인
2. 보컬만 Solo → 명료하게 들리는지 확인
3. 기타·피아노 Mute → 보컬이 더 선명해지는지 확인
  - 선명해지면 해당 악기가 마스킹 원인

### 스펙트럼 분석

1. 스펙트럼 분석기 플러그인 사용 (SPAN 등)
2. 각 트랙의 에너지 집중 대역 파악
3. 500Hz~3kHz 구간에서 여러 트랙 에너지 겹침 확인

### 솔로 vs 전체 비교

- Solo에서 좋은 소리가 전체에서 묻힘 → 마스킹
- 각 트랙 Solo 음질보다 전체 믹스 균형이 중요

---

## EQ 카빙 (Carving) 기법

이펙트를 추가하기 전에 원음의 문제를 먼저 해결하는 것이 올바른 순서입니다.

### 보컬 공간 확보를 위한 기타 EQ

1. 기타 트랙에 EQ 삽입
2. 보컬 주파수(1~3kHz) 구간 좁은 Q로 -3~-6dB 컷
  - 기타 다이나믹 EQ 활용 시 더 자연스러움
3. 보컬 재생 시 기타와 겹침 확인

### 피아노·건반 EQ 카빙

1. 800Hz~2kHz 구간 -2~-4dB
2. 보컬 존재감 주파수 비워주기
3. 피아노 바디감(200~400Hz)은 유지

### 킥-베이스 충돌 해결

1. 킥 드럼: 60Hz 부스트, 베이스 Sub 컷 (80~100Hz)
2. 베이스: 킥 이후 100~200Hz 구간 부스트
3. 사이드체인으로 킥과 베이스 타이밍 분리

---

## 악기별 주파수 공간 배분 전략

플러그인을 추가하기 전에 게인 스테이징이 올바른지 먼저 확인합니다.

### 저역 (20~200Hz)

- 킥 드럼 Sub: 50~80Hz
- 베이스 기본음: 80~160Hz
- 어쿠스틱 기타 바디: 80~150Hz (컷 권장)
- 킥과 베이스가 공간 분점

### 중저역 (200Hz~1kHz)

- 스네어 바디: 200~300Hz
- 어쿠스틱 기타 몸통: 300~500Hz
- 보컬 가슴 공명: 300~500Hz
- 보컬 저중역 컷으로 악기 공간 확보

### 중역 (1kHz~5kHz)

- 보컬 존재감: 1~4kHz (핵심 공간)
- 기타 중역: 2~4kHz → 컷 필요
- 피아노 중역: 1~3kHz → 컷 필요
- 보컬 우선권 확보

### 고역 (5kHz~)

- 보컬 공기감: 8~12kHz
- 심벌·하이햇: 8kHz~
- 고역 공간은 공유 가능

---

## 다이나믹 EQ로 지능형 마스킹 해결

바이패스로 전후 비교하는 습관이 과처리를 막는 가장 효과적인 방법입니다.

### 다이나믹 EQ 설정

1. 기타 트랙에 다이나믹 EQ 삽입
2. 보컬 활성 구간(사이드체인: 보컬 트랙)
  - 보컬이 들어올 때만 기타 중역 자동 감소
3. 보컬 없는 구간: 기타 원래 중역 유지
- 보컬 구간에서만 마스킹 해결 (자연스러움)

### 권장 설정

- 대역: 1~3kHz
- Threshold: -20dBFS 내외
- 감소량: -3~-6dB
- Attack: 10ms, Release: 100ms

---

## 마치며

주파수 마스킹 해결은 EQ 부스트보다 카빙(컷)이 우선입니다.

---

[보컬 EQ 완전 가이드](/stories/eq-guide1) | [보컬 신호 체인 완전 가이드](/stories/vocal-chain1) | [디에서(De-esser) 완전 가이드](/stories/de-esser1) | [믹싱 워크플로우 완전 가이드](/stories/mixing-workflow1) | [온라인 믹싱 의뢰 방법](/stories/onlinemix1) | [피아노 리듬감·리듬 훈련 음악연습실](/stories/practice-room-piano-rhythm1) | [기타 트레몰로·웜바 암 테크닉 음악연습실](/stories/practice-room-guitar-whammy1) | [보컬 다이나믹스·크레셴도 데크레셴도 음악연습실](/stories/practice-room-vocal-dynamics1) | [기타 줄 교체·스트링 선택 음악연습실](/stories/practice-room-guitar-string1) | [드럼 브러쉬·와이어 브러쉬 연주 음악연습실](/stories/practice-room-drum-brush1) | [피아노 즉흥 반주·코드 반주 음악연습실](/stories/practice-room-piano-sight-play1) | [베이스 코드·화음 연주 음악연습실](/stories/practice-room-bass-chord1) | [보컬 팔세토·가성 발성 음악연습실](/stories/practice-room-vocal-falsetto1) | [기타 탭핑·투핸드 태핑 음악연습실](/stories/practice-room-guitar-tapping1) | [피아노 듀엣·앙상블 개인 연습 음악연습실](/stories/practice-room-piano-duet1) | [드럼 폴리리듬·복잡박자 연습 음악연습실](/stories/practice-room-drum-polyrhythm1) | [보컬 어질리티·빠른 음계 훈련 음악연습실](/stories/practice-room-vocal-agility1) | [재즈 피아노 즉흥 솔로·임프로비제이션 음악연습실](/stories/practice-room-piano-jazz-improv1) | [기타 레가토·해머온 풀오프 연습 음악연습실](/stories/practice-room-guitar-legato1) | [베이스 펑크·R&B 그루브 음악연습실](/stories/practice-room-bass-funk1) | [보컬 프로젝션·소리 울림 훈련 음악연습실](/stories/practice-room-vocal-projection1) | [피아노 옥타브·넓은 음정 도약 연습 음악연습실](/stories/practice-room-piano-technique31) | [기타 슬라이드·슬라이드 기타 연습 음악연습실](/stories/practice-room-guitar-slide1) | [보컬 스타일 개발·장르별 창법 음악연습실](/stories/practice-room-vocal-style1) | [통기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-acoustic-fingerpick1) | [드럼 하이햇·심벌 컨트롤 음악연습실](/stories/practice-room-drum-hihat1) | [피아노 트릴·장식음 기법 음악연습실](/stories/practice-room-piano-trills1) | [기타 코드 진행·화성 이해 음악연습실](/stories/practice-room-guitar-chord-prog1) | [장르별 보컬 특성·크로스오버 보컬 음악연습실](/stories/practice-room-vocal-genre1) | [베이스 썸피킹·핑거스타일 혼합 음악연습실](/stories/practice-room-bass-thumb1) | [피아노 발라드 반주·감성 피아노 음악연습실](/stories/practice-room-piano-ballad21) | [기타 아르페지오·분산 화음 연습 음악연습실](/stories/practice-room-guitar-arpeggio1) | [보컬 녹음 준비·레코딩 보컬 음악연습실](/stories/practice-room-vocal-recording1) | [가스펠·CCM 피아노 반주 음악연습실](/stories/practice-room-piano-gospel1) | [기타 핑거스타일 고급·솔로 기타 편곡 음악연습실](/stories/practice-room-guitar-fingerpick-adv1) | [드럼 킥·베이스 드럼 테크닉 음악연습실](/stories/practice-room-drum-kick1) | [보컬 벨팅·파워 벨팅 음악연습실](/stories/practice-room-vocal-belting1) | [피아노 컴핑·재즈 반주 패턴 음악연습실](/stories/practice-room-piano-comping1) | [기타 피치카토·뮤트 주법 음악연습실](/stories/practice-room-guitar-mute1) | [베이스 핑거링·오른손 테크닉 음악연습실](/stories/practice-room-bass-fingering1) | [보컬 스타카토·단음 발성 훈련 음악연습실](/stories/practice-room-vocal-staccato1) | [드럼 심벌·크래쉬·라이드 테크닉 음악연습실](/stories/practice-room-drum-cymbal1) | [피아노 크로스 핸드·교차 손 훈련 음악연습실](/stories/practice-room-piano-crosshand1) | [기타 스케일 연습·포지션 이동 음악연습실](/stories/practice-room-guitar-scale-pos1) | [보컬 레가토·이어 부르기 훈련 음악연습실](/stories/practice-room-vocal-legato1) | [피아노 연탄·네 손 피아노 음악연습실](/stories/practice-room-piano-four-hands1) | [기타 핑거링·왼손 독립 훈련 음악연습실](/stories/practice-room-guitar-left-hand1) | [보컬 오버톤·배음 발성 훈련 음악연습실](/stories/practice-room-vocal-overtone1) | [드럼 스네어·림샷 테크닉 음악연습실](/stories/practice-room-drum-snare1) | [기타 왼손 비브라토·핑거 비브라토 음악연습실](/stories/practice-room-guitar-finger-vibrato1) | [피아노 루바토·음악적 템포 표현 음악연습실](/stories/practice-room-piano-rubato1) | [베이스 이펙터·페달 보드 활용 음악연습실](/stories/practice-room-bass-effects1) | [보컬 크루닝·저음 보컬 테크닉 음악연습실](/stories/practice-room-vocal-crooning1) | [피아노 소나타·클래식 소나타 형식 연습 음악연습실](/stories/practice-room-piano-sonata1) | [기타 재즈 코드·재즈 보이싱 음악연습실](/stories/practice-room-guitar-jazz-chord1) | [드럼 빠른 템포·스피드 훈련 음악연습실](/stories/practice-room-drum-speed1) | [보컬 중음역 강화·미들 보이스 음악연습실](/stories/practice-room-vocal-middle1) | [피아노 에튀드·기법 연습곡 음악연습실](/stories/practice-room-piano-etude1) | [기타 오픈 튜닝·슬라이드 오픈 튜닝 음악연습실](/stories/practice-room-guitar-open-tuning1) | [보컬 앙상블·코러스 개인 파트 훈련 음악연습실](/stories/practice-room-vocal-ensemble1) | [베이스 픽 주법·픽 베이스 연습 음악연습실](/stories/practice-room-bass-pick1) | [드럼 카운트·리듬 카운팅 훈련 음악연습실](/stories/practice-room-drum-count1) | [피아노 반음계·크로매틱 스케일 음악연습실](/stories/practice-room-piano-chromatic1) | [기타 핑거링 스트레칭·손가락 유연성 음악연습실](/stories/practice-room-guitar-stretch1) | [보컬 피치 컨트롤·음정 정확도 고급 훈련 음악연습실](/stories/practice-room-vocal-pitch1) | [베이스 슬라이드·포르타멘토 베이스 음악연습실](/stories/practice-room-bass-slide1) | [피아노 다이나믹·강약 표현 음악연습실](/stories/practice-room-piano-dynamics1) | [드럼 고스트 노트·유령음 훈련 음악연습실](/stories/practice-room-drum-ghost1) | [기타 코드 아르페지오·코드 분산 연주 음악연습실](/stories/practice-room-guitar-chord-arpeggio1) | [보컬 구음·솔페지오 훈련 음악연습실](/stories/practice-room-vocal-solfege1) | [피아노 폴리포니·독립 성부 연주 음악연습실](/stories/practice-room-piano-polyphony1) | [기타 리프·반복 패턴 작성 음악연습실](/stories/practice-room-guitar-riff1) | [드럼 오프비트·엇박 리듬 훈련 음악연습실](/stories/practice-room-drum-offbeat1) | [보컬 호흡 발음·자음 명료도 훈련 음악연습실](/stories/practice-room-vocal-consonant1) | [피아노 전조·조바꿈 연습 음악연습실](/stories/practice-room-piano-modulation1) | [기타 핑거피킹 패턴 다양화 음악연습실](/stories/practice-room-guitar-fingerpick-pattern1) | [베이스 뮤팅·노이즈 컨트롤 음악연습실](/stories/practice-room-bass-muting1) | [드럼 더블킥·더블 베이스 드럼 훈련 음악연습실](/stories/practice-room-drum-doublekick1) | [피아노 재즈 스탠다드·재즈 레퍼토리 음악연습실](/stories/practice-room-piano-jazz-standard1) | [보컬 라이브 퍼포먼스·공연 전 루틴 음악연습실](/stories/practice-room-vocal-live1) | [기타 뮤직 메모리·악보 없이 연주하기 음악연습실](/stories/practice-room-guitar-memory1) | [피아노 연속 도약·넓은 음정 점프 음악연습실](/stories/practice-room-piano-leaps1) | [드럼 크레셴도·다이나믹 빌드업 음악연습실](/stories/practice-room-drum-buildup1) | [베이스 펜타토닉·베이스 스케일 활용 음악연습실](/stories/practice-room-bass-pentatonic1) | [보컬 감정 표현·가사 해석 훈련 음악연습실](/stories/practice-room-vocal-emotion1) | [기타 해머온·풀오프 연속 훈련 음악연습실](/stories/practice-room-guitar-hammer-pull1) | [피아노 내성부·보조 선율 연습 음악연습실](/stories/practice-room-piano-inner-voice1) | [드럼 림샷·크로스스틱 고급 훈련 음악연습실](/stories/practice-room-drum-rimshot-adv1) | [보컬 뮤지컬 스타일·역할 보컬 훈련 음악연습실](/stories/practice-room-vocal-musical-style1) | [베이스 슬랩·팝핑 고급 테크닉 음악연습실](/stories/practice-room-bass-slap-adv1) | [피아노 초견 고급·빠른 악보 읽기 음악연습실](/stories/practice-room-piano-sight-adv1) | [드럼 타이밍·포켓 그루브 훈련 음악연습실](/stories/practice-room-drum-timing1) | [보컬 호흡·성대 컨트롤 고급 훈련 음악연습실](/stories/practice-room-vocal-breath-adv1) | [기타 비브라토·피치 컨트롤 음악연습실](/stories/practice-room-guitar-vibrato1) | [피아노 화성·코드 고급 이론 음악연습실](/stories/practice-room-piano-chord-adv1) | [재즈 베이스·워킹 베이스 고급 음악연습실](/stories/practice-room-bass-jazz1) | [보컬 음색 개발·개성 있는 목소리 훈련 음악연습실](/stories/practice-room-vocal-color-adv1) | [드럼 선형 리듬·리니어 드러밍 음악연습실](/stories/practice-room-drum-linear1) | [피아노 고급 테크닉·연주 기법 종합 음악연습실](/stories/practice-room-piano-technique-adv1) | [기타 코드 고급·확장 코드 연주 음악연습실](/stories/practice-room-guitar-chord-adv1) | [보컬 레지스터·성구 전환 훈련 음악연습실](/stories/practice-room-vocal-register1) | [베이스 루트 노트·코드 읽기 고급 음악연습실](/stories/practice-room-bass-root-adv1) | [피아노 터치·아티큘레이션 훈련 음악연습실](/stories/practice-room-piano-touch1) | [재즈 드럼 고급·스윙 필 심화 음악연습실](/stories/practice-room-drum-jazz-adv1) | [보컬 무대 퍼포먼스 고급·스테이지 존재감 음악연습실](/stories/practice-room-vocal-stage-adv1) | [기타 즉흥 연주·임프로비제이션 음악연습실](/stories/practice-room-guitar-improv1) | [성인 피아노 입문·처음 시작하는 어른 음악연습실](/stories/practice-room-piano-beginner-adult1) | [드럼 악센트·강세 패턴 훈련 음악연습실](/stories/practice-room-drum-accent1) | [베이스 옥타브 주법·옥타브 그루브 음악연습실](/stories/practice-room-bass-octave1) | [피아노 음정·인터벌 훈련 음악연습실](/stories/practice-room-piano-interval1) | [보컬 오디션 준비·심사 기준 이해 음악연습실](/stories/practice-room-vocal-audition1) | [기타 핑거스타일 고급 테크닉 음악연습실](/stories/practice-room-guitar-fingerstyle-adv1) | [베이스 플래절렛·하모닉스 주법 음악연습실](/stories/practice-room-bass-harmonic1) | [피아노 페달 테크닉·소스텐우토 음악연습실](/stories/practice-room-piano-pedal1) | [피아노 스케일·아르페지오 고급 훈련 음악연습실](/stories/practice-room-piano-scale-adv1) | [베이스 타핑·투핸드 테크닉 음악연습실](/stories/practice-room-bass-tapping1) | [보컬 리듬·박자감 훈련 음악연습실](/stories/practice-room-vocal-rhythm1) | [기타 재즈 보이싱·코드 멜로디 음악연습실](/stories/practice-room-guitar-jazz-voicing1) | [피아노 즉흥 연주·재즈 피아노 음악연습실](/stories/practice-room-piano-jazz1) | [보컬 코러스·하모니 훈련 음악연습실](/stories/practice-room-vocal-harmony1) | [드럼 더블 킥·더블 페달 훈련 음악연습실](/stories/practice-room-drum-double-kick1) | [보컬 마이크 테크닉·PA 활용 음악연습실](/stories/practice-room-vocal-mic1) | [피아노 협주곡·오케스트라 반주 연습 음악연습실](/stories/practice-room-piano-concerto1) | [드럼 필인·트랜지션 고급 훈련 음악연습실](/stories/practice-room-drum-fill-adv1) | [베이스 컨트리·록어빌리 주법 음악연습실](/stories/practice-room-bass-country1) | [기타 피킹 테크닉 고급 훈련 음악연습실](/stories/practice-room-guitar-picking-adv1) | [보컬 발음·딕션 훈련 음악연습실](/stories/practice-room-vocal-diction1) | [드럼 메트로놈·그루브 타이밍 훈련 음악연습실](/stories/practice-room-drum-metronome1) | [베이스 앙상블·밴드 연주 음악연습실](/stories/practice-room-bass-ensemble1) | [기타 블루스 스타일·블루스 표현 음악연습실](/stories/practice-room-guitar-blues1) | [보컬 인디·포크 스타일 음악연습실](/stories/practice-room-vocal-indie1) | [드럼 림샷·고스트노트 테크닉 음악연습실](/stories/practice-room-drum-rimshot1) | [베이스 워킹베이스·재즈 라인 음악연습실](/stories/practice-room-bass-walking1) | [기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-fingerpicking1) | [피아노 리드시트·즉흥 반주 음악연습실](/stories/practice-room-piano-leadsheet1) | [베이스 슬랩·팝핑 테크닉 음악연습실](/stories/practice-room-bass-slap1) | [기타 코드 전환 속도·스무스 체인지 음악연습실](/stories/practice-room-guitar-chord-change1) | [드럼 스네어 튜닝·드럼 헤드 세팅 음악연습실](/stories/practice-room-drum-snare-tuning1) | [보컬 브레스 컨트롤·호흡 훈련 음악연습실](/stories/practice-room-vocal-breath1) | [피아노 조표·조성 이해 음악연습실](/stories/practice-room-piano-key-signature1) | [기타 스트러밍 패턴·리듬 연주 음악연습실](/stories/practice-room-guitar-strumming1) | [드럼 재즈 라이드·스윙 패턴 음악연습실](/stories/practice-room-drum-jazz-ride1) | [베이스 루트·5도 패턴·기초 라인 음악연습실](/stories/practice-room-bass-root-fifth1) | [기타 핑거링·왼손 운지 훈련 음악연습실](/stories/practice-room-guitar-fingering1) | [연신내 음악연습실 안내](/stories/practice-room-yeonsinnae1) | [스튜디오 놀 이용 요금](/pricing)
