---
title: "드럼 녹음 완전 가이드 — 마이킹 배치·룸 어쿠스틱·드럼 EQ 실전 방법"
date: 2026-04-06
author: "스튜디오 놀"
category: "강좌"
tags: ["드럼 녹음", "드럼 마이킹", "킥 마이킹", "스네어 마이킹", "오버헤드 마이킹", "드럼 EQ", "드럼 레코딩"]
thumbnail: "/images/hardware4.webp"
summary: "드럼 녹음 완전 가이드입니다. 킥·스네어·오버헤드·룸 마이크 배치, 드럼 주파수별 EQ 설정값, 드럼 튜닝 체크리스트, 전자 드럼 녹음 방법을 정리합니다."
faq:
  - q: "드럼 녹음에 최소 몇 개의 마이크가 필요한가요?"
    a: "최소 2개(오버헤드 스테레오)로 전체 드럼 사운드를 잡을 수 있습니다. 3개라면 킥 + 오버헤드 2개(3-mic 세팅)가 가장 효율적입니다. 전문 스튜디오는 8~12개로 각 드럼을 개별 녹음합니다."
  - q: "킥 드럼 마이킹은 어디에 세우나요?"
    a: "킥 드럼 앞판 홀 안으로 마이크를 넣으면 강한 어택과 펀치감을 얻습니다. 바깥 헤드에서 10~30cm 거리는 더 자연스럽고 둥근 사운드를 냅니다. 2개를 사용하면 안쪽 어택 + 바깥 바디를 블렌딩할 수 있습니다."
  - q: "드럼 녹음 전 튜닝은 왜 중요한가요?"
    a: "드럼 튜닝이 안 되어 있으면 EQ·컴프레서로 교정이 매우 어렵습니다. 킥의 음정이 곡의 키와 충돌하거나, 스네어의 오버튜닝·언더튜닝은 믹싱 단계에서 큰 문제가 됩니다. 녹음 전 드럼 헤드 상태와 튜닝을 반드시 확인하세요."
  - q: "전자 드럼을 녹음할 때 주의사항은 무엇인가요?"
    a: "전자 드럼은 드럼 패드의 MIDI 신호를 DAW에서 받아 VST 드럼 샘플로 트리거합니다. 이때 MIDI 벨로시티와 다이나믹이 자연스럽게 표현되는지 확인하고, 레이턴시(Latency) 최소화가 중요합니다."
---
![드럼 녹음 완전 가이드 — 스튜디오 놀](/images/hardware4.webp)

## 드럼 녹음 — 밴드 사운드의 심장 레코딩

드럼은 모든 악기 중 가장 많은 마이크가 필요하고, 룸 어쿠스틱의 영향을 가장 많이 받는 악기입니다. 올바른 마이킹과 녹음 환경이 드럼 사운드의 80%를 결정합니다.

---

## 드럼 마이킹 구성

팝 필터 하나로 파열음 문제의 상당 부분을 해결할 수 있습니다.

### 기본 3-Mic 세팅

1. 킥 (Bass Drum)
  - 앞판 홀 안 또는 외부 헤드 앞
  - Beta 52A, AKG D112, Shure PGA52
2. 오버헤드 L (Overhead Left)
  - 스네어와 하이햇 중심 위쪽
3. 오버헤드 R (Overhead Right)
  - 플로어 탐과 라이드 위쪽
  - X-Y 또는 ORTF 배치

### 풀 세팅 (8-Mic)

1. 킥 인 (Inside)
2. 킥 아웃 (Outside)
3. 스네어 탑 (Top)
4. 스네어 보텀 (Bottom)
5. 하이햇
6. 오버헤드 L/R
7. 룸 마이크 (Room)

---

## 마이크별 배치 팁

클리핑은 후반에서 복구가 불가능하므로 게인을 보수적으로 설정하는 것이 안전합니다.

### 킥 드럼

- **안쪽**: 비터 쪽으로 5~10cm 거리
- **바깥쪽**: 헤드 중심에서 15~30cm
- 안쪽(어택) + 바깥쪽(바디) 블렌드

### 스네어

- **탑**: 림 안쪽 5cm, 45도 기울임
- **보텀**: 스네어 와이어 향해 기울임
- 위상 반전(Phase) 확인 필수

### 오버헤드

- **스텔스 X-Y**: 두 마이크 교차 배치
- **ORTF**: 17cm 간격, 110도 각도
- 드럼셋 전체를 균형 있게 커버

### 룸 마이크

- 드럼셋에서 1.5~3m 거리
- 자연스러운 공간감과 파워 추가
- 믹싱에서 Parallel 또는 Blend

---

## 드럼 EQ 가이드

테스트 녹음으로 먼저 소리를 확인한 뒤 본 녹음을 진행하는 것이 기본 워크플로우입니다.

### 킥 드럼

- **20~60Hz**: 서브 펀치 (보존 또는 컷)
- **200~300Hz**: 박스 사운드 -3~6dB 컷
- **3~5kHz**: 어택감 부스트
- **하이패스**: 20~30Hz (서브 노이즈)

### 스네어

- **200Hz**: 바디감 조절
- **1~3kHz**: 크랙 어택 부스트
- **8~10kHz**: 스내어 와이어 에어 부스트
- **150~300Hz**: 공명 주파수 노치 컷

### 오버헤드

- **하이패스**: 150~200Hz (킥/베이스 제거)
- **8~15kHz**: 심벌 에어 보존
- 너무 밝으면 10kHz 이상 롤오프

---

## 드럼 녹음 전 체크리스트

마이크 위치를 조금만 바꿔도 음색이 크게 달라지므로 충분한 테스트가 필요합니다.

- 드럼 헤드 상태 확인 (찢어짐·닳음 확인)
- 킥·스네어·탐탐 튜닝 완료
- 스네어 와이어 텐션 확인
- 하드웨어 삐걱거림 점검
- 심벌 움직임 최소화 (스탠드 고정)
- 룸 반사음 확인 (흡음재 배치)
- 마이크 배치 후 위상 체크

---

## 마치며

드럼 녹음은 사전 준비(튜닝·마이킹)와 룸 어쿠스틱이 전부입니다.

---

[현악기·관악기 레코딩 완전 가이드](/stories/strings-recording1) | [기타 녹음 완전 가이드](/stories/guitar-recording1) | [베이스 녹음 완전 가이드](/stories/bass-recording1) | [마이크 종류 완전 가이드](/stories/microphone-types1) | [온라인 믹싱 의뢰 방법](/stories/onlinemix1) | [스튜디오 놀 이용 요금](/pricing) | [피아노 리듬감·리듬 훈련 음악연습실](/stories/practice-room-piano-rhythm1) | [기타 트레몰로·웜바 암 테크닉 음악연습실](/stories/practice-room-guitar-whammy1) | [보컬 다이나믹스·크레셴도 데크레셴도 음악연습실](/stories/practice-room-vocal-dynamics1) | [기타 줄 교체·스트링 선택 음악연습실](/stories/practice-room-guitar-string1) | [드럼 브러쉬·와이어 브러쉬 연주 음악연습실](/stories/practice-room-drum-brush1) | [피아노 즉흥 반주·코드 반주 음악연습실](/stories/practice-room-piano-sight-play1) | [베이스 코드·화음 연주 음악연습실](/stories/practice-room-bass-chord1) | [보컬 팔세토·가성 발성 음악연습실](/stories/practice-room-vocal-falsetto1) | [기타 탭핑·투핸드 태핑 음악연습실](/stories/practice-room-guitar-tapping1) | [피아노 듀엣·앙상블 개인 연습 음악연습실](/stories/practice-room-piano-duet1) | [드럼 폴리리듬·복잡박자 연습 음악연습실](/stories/practice-room-drum-polyrhythm1) | [보컬 어질리티·빠른 음계 훈련 음악연습실](/stories/practice-room-vocal-agility1) | [재즈 피아노 즉흥 솔로·임프로비제이션 음악연습실](/stories/practice-room-piano-jazz-improv1) | [기타 레가토·해머온 풀오프 연습 음악연습실](/stories/practice-room-guitar-legato1) | [베이스 펑크·R&B 그루브 음악연습실](/stories/practice-room-bass-funk1) | [보컬 프로젝션·소리 울림 훈련 음악연습실](/stories/practice-room-vocal-projection1) | [피아노 옥타브·넓은 음정 도약 연습 음악연습실](/stories/practice-room-piano-technique31) | [기타 슬라이드·슬라이드 기타 연습 음악연습실](/stories/practice-room-guitar-slide1) | [보컬 스타일 개발·장르별 창법 음악연습실](/stories/practice-room-vocal-style1) | [통기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-acoustic-fingerpick1) | [드럼 하이햇·심벌 컨트롤 음악연습실](/stories/practice-room-drum-hihat1) | [피아노 트릴·장식음 기법 음악연습실](/stories/practice-room-piano-trills1) | [기타 코드 진행·화성 이해 음악연습실](/stories/practice-room-guitar-chord-prog1) | [장르별 보컬 특성·크로스오버 보컬 음악연습실](/stories/practice-room-vocal-genre1) | [베이스 썸피킹·핑거스타일 혼합 음악연습실](/stories/practice-room-bass-thumb1) | [피아노 발라드 반주·감성 피아노 음악연습실](/stories/practice-room-piano-ballad21) | [기타 아르페지오·분산 화음 연습 음악연습실](/stories/practice-room-guitar-arpeggio1) | [보컬 녹음 준비·레코딩 보컬 음악연습실](/stories/practice-room-vocal-recording1) | [가스펠·CCM 피아노 반주 음악연습실](/stories/practice-room-piano-gospel1) | [기타 핑거스타일 고급·솔로 기타 편곡 음악연습실](/stories/practice-room-guitar-fingerpick-adv1) | [드럼 킥·베이스 드럼 테크닉 음악연습실](/stories/practice-room-drum-kick1) | [보컬 벨팅·파워 벨팅 음악연습실](/stories/practice-room-vocal-belting1) | [피아노 컴핑·재즈 반주 패턴 음악연습실](/stories/practice-room-piano-comping1) | [기타 피치카토·뮤트 주법 음악연습실](/stories/practice-room-guitar-mute1) | [베이스 핑거링·오른손 테크닉 음악연습실](/stories/practice-room-bass-fingering1) | [보컬 스타카토·단음 발성 훈련 음악연습실](/stories/practice-room-vocal-staccato1) | [드럼 심벌·크래쉬·라이드 테크닉 음악연습실](/stories/practice-room-drum-cymbal1) | [피아노 크로스 핸드·교차 손 훈련 음악연습실](/stories/practice-room-piano-crosshand1) | [기타 스케일 연습·포지션 이동 음악연습실](/stories/practice-room-guitar-scale-pos1) | [보컬 레가토·이어 부르기 훈련 음악연습실](/stories/practice-room-vocal-legato1) | [피아노 연탄·네 손 피아노 음악연습실](/stories/practice-room-piano-four-hands1) | [기타 핑거링·왼손 독립 훈련 음악연습실](/stories/practice-room-guitar-left-hand1) | [보컬 오버톤·배음 발성 훈련 음악연습실](/stories/practice-room-vocal-overtone1) | [드럼 스네어·림샷 테크닉 음악연습실](/stories/practice-room-drum-snare1) | [기타 왼손 비브라토·핑거 비브라토 음악연습실](/stories/practice-room-guitar-finger-vibrato1) | [피아노 루바토·음악적 템포 표현 음악연습실](/stories/practice-room-piano-rubato1) | [베이스 이펙터·페달 보드 활용 음악연습실](/stories/practice-room-bass-effects1) | [보컬 크루닝·저음 보컬 테크닉 음악연습실](/stories/practice-room-vocal-crooning1) | [피아노 소나타·클래식 소나타 형식 연습 음악연습실](/stories/practice-room-piano-sonata1) | [기타 재즈 코드·재즈 보이싱 음악연습실](/stories/practice-room-guitar-jazz-chord1) | [드럼 빠른 템포·스피드 훈련 음악연습실](/stories/practice-room-drum-speed1) | [보컬 중음역 강화·미들 보이스 음악연습실](/stories/practice-room-vocal-middle1) | [피아노 에튀드·기법 연습곡 음악연습실](/stories/practice-room-piano-etude1) | [기타 오픈 튜닝·슬라이드 오픈 튜닝 음악연습실](/stories/practice-room-guitar-open-tuning1) | [보컬 앙상블·코러스 개인 파트 훈련 음악연습실](/stories/practice-room-vocal-ensemble1) | [베이스 픽 주법·픽 베이스 연습 음악연습실](/stories/practice-room-bass-pick1) | [드럼 카운트·리듬 카운팅 훈련 음악연습실](/stories/practice-room-drum-count1) | [피아노 반음계·크로매틱 스케일 음악연습실](/stories/practice-room-piano-chromatic1) | [연신내 음악연습실 안내](/stories/practice-room-yeonsinnae1)
