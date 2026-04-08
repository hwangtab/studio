---
title: "신스 프로그래밍 완전 가이드 — ADSR·오실레이터·필터·LFO 활용법"
date: 2026-04-07
author: "스튜디오 놀"
category: "음반 제작 가이드"
tags: ["신스 프로그래밍", "신디사이저 파라미터", "ADSR 엔벨로프", "오실레이터", "필터 신스", "LFO", "소프트 신디사이저"]
thumbnail: "/images/portfolio3.webp"
summary: "신스 프로그래밍 완전 가이드입니다. ADSR 엔벨로프, 오실레이터 파형, 로우패스 필터, LFO 활용, 아날로그·디지털 신스 비교, 장르별 신스 사운드 만들기를 정리합니다."
faq:
  - q: "ADSR이란 무엇인가요?"
    a: "ADSR은 Attack(어택), Decay(디케이), Sustain(서스테인), Release(릴리즈)의 약자입니다. 신스 소리의 시간에 따른 음량 변화를 제어합니다. Attack은 소리가 시작되는 속도, Decay는 피크에서 Sustain 레벨까지 떨어지는 시간, Sustain은 건반을 누르는 동안 유지되는 레벨, Release는 건반에서 손을 떼고 소리가 사라지는 속도입니다."
  - q: "신스의 오실레이터 파형 종류는?"
    a: "사인파(Sine): 부드럽고 순수한 음색. 삼각파(Triangle): 약한 배음. 톱니파(Sawtooth): 풍부한 배음, 현악기·리드 사운드. 사각파(Square): 공허한 배음, 베이스. 화이트노이즈: 모든 주파수를 포함, 퍼커션·효과음에 사용합니다."
  - q: "로우패스 필터의 Cutoff와 Resonance란?"
    a: "Cutoff 주파수는 필터가 고역을 차단하기 시작하는 주파수입니다. Cutoff를 낮추면 소리가 어두워지고, 높이면 밝아집니다. Resonance(Emphasis)는 Cutoff 주파수 근처를 강조해 공명음이 생깁니다. 높은 Resonance는 자기 발진을 일으킬 수 있습니다."
  - q: "LFO는 어디에 사용하나요?"
    a: "LFO(Low Frequency Oscillator)는 주로 Pitch(비브라토), Amplitude(트레몰로), Filter Cutoff(와우와우 효과)에 연결해 음악적 모듈레이션을 만듭니다. LFO Rate로 속도, Depth로 변조 깊이를 조정합니다."
---
![신스 프로그래밍 완전 가이드 — 스튜디오 놀](/images/portfolio3.webp)

## 신스 프로그래밍 — 소리를 디자인하다

신스 프로그래밍을 이해하면 상상하는 어떤 사운드도 만들 수 있습니다.

---

## 신스의 기본 구조

절차를 미리 파악해두면 발매 일정이 밀리는 사고를 방지할 수 있습니다.

### 가산 합성 신스 신호 흐름

오실레이터(Oscillator)
- 필터(Filter)
- 앰플리파이어(Amplifier)
- ADSR 엔벨로프 적용
- LFO 모듈레이션 추가
- 이펙트 (리버브/딜레이/코러스)

---

## ADSR 엔벨로프

세금 신고와 수익 정산 주기를 미리 파악해두면 현금 흐름 관리에 도움이 됩니다.

### 파라미터 설명

**Attack (어택)**
- 키를 누를 때 0 → 피크까지 도달 시간
- 빠름: 즉각적인 어택, 퍼커션 느낌
- 느림: 패드·현악기 분위기

**Decay (디케이)**
- 피크에서 Sustain 레벨까지 떨어지는 시간
- 짧음: 플럭 사운드
- 긴 Decay + 낮은 Sustain: 피아노 느낌

**Sustain (서스테인)**
- 키를 누르는 동안 유지되는 레벨 (0~100%)
- 높음: 오르간·리드 사운드
- 낮음: 플럭·피치카토

**Release (릴리즈)**
- 키 오프 후 소리가 사라지는 시간
- 짧음: 건반 같은 끊김
- 긴: 현악기·패드의 잔향

### 사운드 유형별 ADSR 가이드

- **피아노 사운드**: A짧음, D긴, S낮음, R중간
- **패드 사운드**: A긴, D짧음, S높음, R긴
- **플럭 사운드**: A빠름, D짧음, S낮음, R짧음
- **베이스 사운드**: A빠름, D중간, S중간, R짧음

---

## 오실레이터 파형

수익 창출 이전에 저작권 등록을 완료해두면 불필요한 분쟁을 예방할 수 있습니다.

### 주요 파형 특성

**사인파 (Sine Wave)**
- 기본 주파수만 포함, 배음 없음
- 서브 베이스, 킥 드럼 보디

**톱니파 (Sawtooth Wave)**
- 모든 배음 포함, 가장 풍부한 소리
- 리드 신스, 현악기 에뮬레이션, 브라스

**사각파 (Square Wave)**
- 홀수 배음 포함
- 클라리넷 느낌, 8비트 사운드

**삼각파 (Triangle Wave)**
- 홀수 배음 (사각파보다 약)
- 부드러운 플럭, 첼레스타 느낌

**노이즈 (Noise)**
- 화이트노이즈: 퍼커션 노이즈
- 핑크노이즈: 바람 소리, 앰비언스

---

## 필터

계약서의 세부 조항을 꼼꼼히 확인하는 습관이 장기적으로 큰 손실을 막아줍니다.

### 로우패스 필터 (LPF) - 가장 많이 사용

- Cutoff 이하 주파수만 통과
- Cutoff 낮춤 → 어두운 소리
- Cutoff 높임 → 밝은 소리

### Resonance/Emphasis

- Cutoff 근처 주파수 강조
- 낮음: 부드러운 필터 롤오프
- 높음: 와우와우 느낌, 자기 발진

### 필터 모듈레이션

엔벨로프 → 필터 Cutoff 연결:
Attack 시 Cutoff 열림 → 밝은 어택
Release 시 Cutoff 닫힘 → 사라지는 소리

---

## LFO (Low Frequency Oscillator)

플러그인을 추가하기 전에 게인 스테이징이 올바른지 먼저 확인합니다.

### LFO 모듈레이션 대상

Pitch → 비브라토 (음정 주기적 변화)
Amplitude → 트레몰로 (음량 주기적 변화)
Filter Cutoff → 와우와우 효과
Pan → 자동 패닝 효과

### LFO 파라미터

- **Rate**: 모듈레이션 속도 (Hz 또는 템포 동기)
- **Depth**: 모듈레이션 깊이
- **Shape**: LFO 파형 (사인/사각/삼각/무작위)

---

## 장르별 신스 사운드

스트리밍 데이터를 분석하면 마케팅 전략을 더욱 정밀하게 조정할 수 있습니다.

### 팝/팝 R&B

- 패드: A긴/고 Sustain/R긴, LPF 반쯤 열림
- 리드: 톱니파, 약간의 Resonance, 비브라토 LFO

### 힙합/트랩

- 808 베이스: 사인파, A빠름, D긴, 피치 슬라이드
- 클랩: 화이트노이즈 기반

### 신스팝/레트로

- 아르페지오: 사각파, 빠른 어택
- 리드: 톱니파 + Resonance

---

## 마치며

신스 프로그래밍은 사운드 디자인의 언어입니다.

---

[사운드 디자인 완전 가이드](/stories/sound-design1) | [비트 메이킹 완전 가이드](/stories/beatmaking1) | [드럼 프로그래밍 완전 가이드](/stories/drum-programming1) | [코드 진행 완전 가이드](/stories/chord-progressions1) | [온라인 믹싱 의뢰 방법](/stories/onlinemix1) | [피아노 리듬감·리듬 훈련 음악연습실](/stories/practice-room-piano-rhythm1) | [기타 트레몰로·웜바 암 테크닉 음악연습실](/stories/practice-room-guitar-whammy1) | [보컬 다이나믹스·크레셴도 데크레셴도 음악연습실](/stories/practice-room-vocal-dynamics1) | [기타 줄 교체·스트링 선택 음악연습실](/stories/practice-room-guitar-string1) | [드럼 브러쉬·와이어 브러쉬 연주 음악연습실](/stories/practice-room-drum-brush1) | [피아노 즉흥 반주·코드 반주 음악연습실](/stories/practice-room-piano-sight-play1) | [베이스 코드·화음 연주 음악연습실](/stories/practice-room-bass-chord1) | [보컬 팔세토·가성 발성 음악연습실](/stories/practice-room-vocal-falsetto1) | [기타 탭핑·투핸드 태핑 음악연습실](/stories/practice-room-guitar-tapping1) | [피아노 듀엣·앙상블 개인 연습 음악연습실](/stories/practice-room-piano-duet1) | [드럼 폴리리듬·복잡박자 연습 음악연습실](/stories/practice-room-drum-polyrhythm1) | [보컬 어질리티·빠른 음계 훈련 음악연습실](/stories/practice-room-vocal-agility1) | [재즈 피아노 즉흥 솔로·임프로비제이션 음악연습실](/stories/practice-room-piano-jazz-improv1) | [기타 레가토·해머온 풀오프 연습 음악연습실](/stories/practice-room-guitar-legato1) | [베이스 펑크·R&B 그루브 음악연습실](/stories/practice-room-bass-funk1) | [보컬 프로젝션·소리 울림 훈련 음악연습실](/stories/practice-room-vocal-projection1) | [피아노 옥타브·넓은 음정 도약 연습 음악연습실](/stories/practice-room-piano-technique31) | [기타 슬라이드·슬라이드 기타 연습 음악연습실](/stories/practice-room-guitar-slide1) | [보컬 스타일 개발·장르별 창법 음악연습실](/stories/practice-room-vocal-style1) | [통기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-acoustic-fingerpick1) | [드럼 하이햇·심벌 컨트롤 음악연습실](/stories/practice-room-drum-hihat1) | [피아노 트릴·장식음 기법 음악연습실](/stories/practice-room-piano-trills1) | [기타 코드 진행·화성 이해 음악연습실](/stories/practice-room-guitar-chord-prog1) | [장르별 보컬 특성·크로스오버 보컬 음악연습실](/stories/practice-room-vocal-genre1) | [베이스 썸피킹·핑거스타일 혼합 음악연습실](/stories/practice-room-bass-thumb1) | [피아노 발라드 반주·감성 피아노 음악연습실](/stories/practice-room-piano-ballad21) | [기타 아르페지오·분산 화음 연습 음악연습실](/stories/practice-room-guitar-arpeggio1) | [보컬 녹음 준비·레코딩 보컬 음악연습실](/stories/practice-room-vocal-recording1) | [가스펠·CCM 피아노 반주 음악연습실](/stories/practice-room-piano-gospel1) | [기타 핑거스타일 고급·솔로 기타 편곡 음악연습실](/stories/practice-room-guitar-fingerpick-adv1) | [드럼 킥·베이스 드럼 테크닉 음악연습실](/stories/practice-room-drum-kick1) | [보컬 벨팅·파워 벨팅 음악연습실](/stories/practice-room-vocal-belting1) | [피아노 컴핑·재즈 반주 패턴 음악연습실](/stories/practice-room-piano-comping1) | [기타 피치카토·뮤트 주법 음악연습실](/stories/practice-room-guitar-mute1) | [베이스 핑거링·오른손 테크닉 음악연습실](/stories/practice-room-bass-fingering1) | [보컬 스타카토·단음 발성 훈련 음악연습실](/stories/practice-room-vocal-staccato1) | [드럼 심벌·크래쉬·라이드 테크닉 음악연습실](/stories/practice-room-drum-cymbal1) | [피아노 크로스 핸드·교차 손 훈련 음악연습실](/stories/practice-room-piano-crosshand1) | [기타 스케일 연습·포지션 이동 음악연습실](/stories/practice-room-guitar-scale-pos1) | [보컬 레가토·이어 부르기 훈련 음악연습실](/stories/practice-room-vocal-legato1) | [피아노 연탄·네 손 피아노 음악연습실](/stories/practice-room-piano-four-hands1) | [기타 핑거링·왼손 독립 훈련 음악연습실](/stories/practice-room-guitar-left-hand1) | [보컬 오버톤·배음 발성 훈련 음악연습실](/stories/practice-room-vocal-overtone1) | [드럼 스네어·림샷 테크닉 음악연습실](/stories/practice-room-drum-snare1) | [기타 왼손 비브라토·핑거 비브라토 음악연습실](/stories/practice-room-guitar-finger-vibrato1) | [피아노 루바토·음악적 템포 표현 음악연습실](/stories/practice-room-piano-rubato1) | [베이스 이펙터·페달 보드 활용 음악연습실](/stories/practice-room-bass-effects1) | [보컬 크루닝·저음 보컬 테크닉 음악연습실](/stories/practice-room-vocal-crooning1) | [피아노 소나타·클래식 소나타 형식 연습 음악연습실](/stories/practice-room-piano-sonata1) | [기타 재즈 코드·재즈 보이싱 음악연습실](/stories/practice-room-guitar-jazz-chord1) | [드럼 빠른 템포·스피드 훈련 음악연습실](/stories/practice-room-drum-speed1) | [보컬 중음역 강화·미들 보이스 음악연습실](/stories/practice-room-vocal-middle1) | [피아노 에튀드·기법 연습곡 음악연습실](/stories/practice-room-piano-etude1) | [기타 오픈 튜닝·슬라이드 오픈 튜닝 음악연습실](/stories/practice-room-guitar-open-tuning1) | [보컬 앙상블·코러스 개인 파트 훈련 음악연습실](/stories/practice-room-vocal-ensemble1) | [베이스 픽 주법·픽 베이스 연습 음악연습실](/stories/practice-room-bass-pick1) | [드럼 카운트·리듬 카운팅 훈련 음악연습실](/stories/practice-room-drum-count1) | [피아노 반음계·크로매틱 스케일 음악연습실](/stories/practice-room-piano-chromatic1) | [기타 핑거링 스트레칭·손가락 유연성 음악연습실](/stories/practice-room-guitar-stretch1) | [보컬 피치 컨트롤·음정 정확도 고급 훈련 음악연습실](/stories/practice-room-vocal-pitch1) | [베이스 슬라이드·포르타멘토 베이스 음악연습실](/stories/practice-room-bass-slide1) | [피아노 다이나믹·강약 표현 음악연습실](/stories/practice-room-piano-dynamics1) | [드럼 고스트 노트·유령음 훈련 음악연습실](/stories/practice-room-drum-ghost1) | [기타 코드 아르페지오·코드 분산 연주 음악연습실](/stories/practice-room-guitar-chord-arpeggio1) | [보컬 구음·솔페지오 훈련 음악연습실](/stories/practice-room-vocal-solfege1) | [피아노 폴리포니·독립 성부 연주 음악연습실](/stories/practice-room-piano-polyphony1) | [기타 리프·반복 패턴 작성 음악연습실](/stories/practice-room-guitar-riff1) | [드럼 오프비트·엇박 리듬 훈련 음악연습실](/stories/practice-room-drum-offbeat1) | [보컬 호흡 발음·자음 명료도 훈련 음악연습실](/stories/practice-room-vocal-consonant1) | [피아노 전조·조바꿈 연습 음악연습실](/stories/practice-room-piano-modulation1) | [기타 핑거피킹 패턴 다양화 음악연습실](/stories/practice-room-guitar-fingerpick-pattern1) | [베이스 뮤팅·노이즈 컨트롤 음악연습실](/stories/practice-room-bass-muting1) | [드럼 더블킥·더블 베이스 드럼 훈련 음악연습실](/stories/practice-room-drum-doublekick1) | [피아노 재즈 스탠다드·재즈 레퍼토리 음악연습실](/stories/practice-room-piano-jazz-standard1) | [연신내 음악연습실 안내](/stories/practice-room-yeonsinnae1) | [스튜디오 놀 이용 요금](/pricing)
