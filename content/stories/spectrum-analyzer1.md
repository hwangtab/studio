---
title: "스펙트럼 분석기 완전 가이드 — 믹싱·마스터링에서 주파수 시각화 활용법"
date: 2026-04-07
author: "스튜디오 놀"
category: "음반 제작 가이드"
tags: ["스펙트럼 분석기", "주파수 분석", "믹싱 시각화", "FFT 분석", "마스터링 스펙트럼", "주파수 밸런스", "Span 플러그인"]
thumbnail: "/images/service6.webp"
summary: "스펙트럼 분석기 완전 가이드입니다. FFT 원리, 믹싱·마스터링에서의 활용법, 주파수 밸런스 체크, 마스킹 발견, SPAN·iZotope Insight 등 추천 플러그인을 정리합니다."
faq:
  - q: "스펙트럼 분석기란 무엇인가요?"
    a: "오디오 신호의 주파수 성분을 실시간으로 시각화하는 도구입니다. 가로축이 주파수(Hz), 세로축이 레벨(dB)로 표시되며, 어느 주파수 대역에 에너지가 집중되어 있는지 한눈에 파악할 수 있습니다."
  - q: "스펙트럼 분석기를 믹싱에 어떻게 활용하나요?"
    a: "주파수 마스킹을 발견할 때 유용합니다. 두 악기가 같은 주파수 대역에 에너지가 집중되면 한쪽이 묻힙니다. 스펙트럼으로 확인 후 EQ로 분리하면 각 악기가 공간을 차지하게 됩니다. 또한 저역 쌓임, 고역 과다 등을 빠르게 발견할 수 있습니다."
  - q: "레퍼런스 트랙과 비교하면 어떤 점이 좋은가요?"
    a: "상업 음원의 스펙트럼 형태를 보여주어 내 믹스가 산업 기준과 얼마나 다른지 파악할 수 있습니다. 일반적으로 상업 음원은 200Hz~3kHz 영역이 평탄하고, 100Hz 이하와 12kHz 이상이 완만하게 감소합니다. 이 형태를 참고해 EQ 방향을 잡을 수 있습니다."
  - q: "무료 스펙트럼 분석기 플러그인을 추천해주세요."
    a: "SPAN by Voxengo가 가장 인기 있는 무료 스펙트럼 분석기입니다. 실시간 FFT + RMS + 피크 표시가 가능합니다. iZotope Insight(유료), Fabfilter Pro-Q 3의 내장 스펙트럼, Youlean Loudness Meter(LUFS + 스펙트럼)도 널리 사용됩니다."
---
![스펙트럼 분석기 완전 가이드 — 스튜디오 놀](/images/service6.webp)

## 스펙트럼 분석기 — 귀로 듣고 눈으로 확인

스펙트럼 분석기는 귀로 판단하기 어려운 주파수 문제를 시각적으로 확인하는 도구입니다. 믹싱·마스터링에서 보조 도구로 활용하면 더 정밀한 결과를 얻을 수 있습니다.

---

## 스펙트럼 분석기 주요 파라미터

| 파라미터 | 설명 | 실용 설정 |
|---------|------|---------|
| FFT Size | 주파수 해상도 (클수록 정밀) | 4096~16384 |
| 평균화 (Average) | 순간 vs 평균 표시 | Medium~Slow |
| 범위 (Range) | 표시 dB 범위 | -120~0dB |
| 기울기 (Tilt) | +3dB/oct 보정 | Pink Noise 기준 |

---

## 믹싱에서 스펙트럼 활용

같은 플러그인이라도 신호 체인의 어느 위치에 두느냐에 따라 결과가 크게 달라집니다.

### 주파수 마스킹 발견

- 보컬 + 기타를 함께 띄워 스펙트럼 비교
- 같은 주파수 대역 겹침 확인
- EQ로 한쪽을 잘라 공간 분리

### 저역 쌓임 확인

- 60~120Hz 과다 에너지 → 하이패스 필터
- 여러 악기의 저역이 쌓이면 믹스가 뭉침
- 각 악기 HPF 포인트를 스펙트럼으로 확인

### 고역 결핍 확인

- 8kHz~16kHz 에너지가 너무 낮으면 답답한 믹스
- 에어 EQ(10kHz 쉘빙) 적용 여부 판단
- 이어폰 vs 스피커 차이를 스펙트럼으로 확인

---

## 마스터링에서 스펙트럼 활용

기본값에서 출발해 한 번에 하나씩 조절하면 각 파라미터의 역할이 명확하게 들립니다.

### 레퍼런스 비교

1. 레퍼런스 트랙 임포트
2. SPAN을 마스터 버스 + 레퍼런스 버스에 각각 배치
3. 두 스펙트럼 형태 비교
- 내 마스터의 과다/결핍 주파수 파악

### 저역 밸런스 체크

- **100Hz 이하 과다**: 스트리밍에서 자동 음압 낮춰짐
- **200~400Hz 머디니스**: 중역이 탁하게 들림
- 스펙트럼 + 귀 동시 확인으로 판단

### 고역 한계 확인

- 12kHz 이상 급격히 하락 → 어두운 마스터
- 16kHz 이상 과다 → 귀 피로, 스트리밍 처리 변형
- 고급 마스터는 16kHz까지 완만하게 유지

---

## 주파수 밸런스 목표값 (장르별)

모노로 확인하면 스테레오에서 감춰진 문제를 더 빨리 발견할 수 있습니다.

### 팝·힙합·R&B 기준

60~100Hz: 킥·베이스 펀치감 (과다면 뭉침)
200~400Hz: 평탄 또는 약간 감소 (머디니스 회피)
1~5kHz: 보컬·악기 존재감 (평탄 유지)
8~16kHz: 완만한 감소 (에어감 유지)

### 어쿠스틱·재즈 기준

100~200Hz: 악기 몸통감 (따뜻한 저음)
2~5kHz: 완만한 증가 없음 (자연스러운 존재감)
- **8kHz 이상**: 더 완만한 감소 (어두운 공기감)

---

## 추천 스펙트럼 분석기 플러그인

| 플러그인 | 가격 | 특징 |
|---------|------|------|
| SPAN by Voxengo | 무료 | 업계 표준 무료 분석기 |
| iZotope Insight 2 | 유료 | LUFS + 스펙트럼 통합 |
| FabFilter Pro-Q 3 | 유료 | EQ 내장 스펙트럼 |
| Youlean Loudness Meter | 무·유료 | LUFS 중심, 스펙트럼 보조 |
| MultiAnalyzer (Melda) | 무료 | 멀티채널 동시 비교 |

---

## 마치며

스펙트럼 분석기는 귀를 대체하는 도구가 아니라 보조하는 도구입니다. 항상 귀로 먼저 판단하고, 의심스러운 부분을 스펙트럼으로 확인하는 순서가 올바른 워크플로우입니다.

---

[파라메트릭 EQ 완전 가이드](/stories/parametric-eq1) | [보컬 EQ 완전 가이드](/stories/eq1) | [주파수 스펙트럼 완전 가이드](/stories/frequency-spectrum1) | [마스터링 완전 가이드](/stories/mastering1) | [온라인 믹싱 의뢰 방법](/stories/onlinemix1) | [피아노 리듬감·리듬 훈련 음악연습실](/stories/practice-room-piano-rhythm1) | [기타 트레몰로·웜바 암 테크닉 음악연습실](/stories/practice-room-guitar-whammy1) | [보컬 다이나믹스·크레셴도 데크레셴도 음악연습실](/stories/practice-room-vocal-dynamics1) | [기타 줄 교체·스트링 선택 음악연습실](/stories/practice-room-guitar-string1) | [드럼 브러쉬·와이어 브러쉬 연주 음악연습실](/stories/practice-room-drum-brush1) | [피아노 즉흥 반주·코드 반주 음악연습실](/stories/practice-room-piano-sight-play1) | [베이스 코드·화음 연주 음악연습실](/stories/practice-room-bass-chord1) | [보컬 팔세토·가성 발성 음악연습실](/stories/practice-room-vocal-falsetto1) | [기타 탭핑·투핸드 태핑 음악연습실](/stories/practice-room-guitar-tapping1) | [피아노 듀엣·앙상블 개인 연습 음악연습실](/stories/practice-room-piano-duet1) | [드럼 폴리리듬·복잡박자 연습 음악연습실](/stories/practice-room-drum-polyrhythm1) | [보컬 어질리티·빠른 음계 훈련 음악연습실](/stories/practice-room-vocal-agility1) | [재즈 피아노 즉흥 솔로·임프로비제이션 음악연습실](/stories/practice-room-piano-jazz-improv1) | [기타 레가토·해머온 풀오프 연습 음악연습실](/stories/practice-room-guitar-legato1) | [베이스 펑크·R&B 그루브 음악연습실](/stories/practice-room-bass-funk1) | [보컬 프로젝션·소리 울림 훈련 음악연습실](/stories/practice-room-vocal-projection1) | [피아노 옥타브·넓은 음정 도약 연습 음악연습실](/stories/practice-room-piano-technique31) | [기타 슬라이드·슬라이드 기타 연습 음악연습실](/stories/practice-room-guitar-slide1) | [보컬 스타일 개발·장르별 창법 음악연습실](/stories/practice-room-vocal-style1) | [통기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-acoustic-fingerpick1) | [드럼 하이햇·심벌 컨트롤 음악연습실](/stories/practice-room-drum-hihat1) | [피아노 트릴·장식음 기법 음악연습실](/stories/practice-room-piano-trills1) | [기타 코드 진행·화성 이해 음악연습실](/stories/practice-room-guitar-chord-prog1) | [장르별 보컬 특성·크로스오버 보컬 음악연습실](/stories/practice-room-vocal-genre1) | [베이스 썸피킹·핑거스타일 혼합 음악연습실](/stories/practice-room-bass-thumb1) | [피아노 발라드 반주·감성 피아노 음악연습실](/stories/practice-room-piano-ballad21) | [기타 아르페지오·분산 화음 연습 음악연습실](/stories/practice-room-guitar-arpeggio1) | [보컬 녹음 준비·레코딩 보컬 음악연습실](/stories/practice-room-vocal-recording1) | [가스펠·CCM 피아노 반주 음악연습실](/stories/practice-room-piano-gospel1) | [기타 핑거스타일 고급·솔로 기타 편곡 음악연습실](/stories/practice-room-guitar-fingerpick-adv1) | [드럼 킥·베이스 드럼 테크닉 음악연습실](/stories/practice-room-drum-kick1) | [보컬 벨팅·파워 벨팅 음악연습실](/stories/practice-room-vocal-belting1) | [피아노 컴핑·재즈 반주 패턴 음악연습실](/stories/practice-room-piano-comping1) | [기타 피치카토·뮤트 주법 음악연습실](/stories/practice-room-guitar-mute1) | [베이스 핑거링·오른손 테크닉 음악연습실](/stories/practice-room-bass-fingering1) | [보컬 스타카토·단음 발성 훈련 음악연습실](/stories/practice-room-vocal-staccato1) | [드럼 심벌·크래쉬·라이드 테크닉 음악연습실](/stories/practice-room-drum-cymbal1) | [피아노 크로스 핸드·교차 손 훈련 음악연습실](/stories/practice-room-piano-crosshand1) | [기타 스케일 연습·포지션 이동 음악연습실](/stories/practice-room-guitar-scale-pos1) | [보컬 레가토·이어 부르기 훈련 음악연습실](/stories/practice-room-vocal-legato1) | [피아노 연탄·네 손 피아노 음악연습실](/stories/practice-room-piano-four-hands1) | [기타 핑거링·왼손 독립 훈련 음악연습실](/stories/practice-room-guitar-left-hand1) | [보컬 오버톤·배음 발성 훈련 음악연습실](/stories/practice-room-vocal-overtone1) | [드럼 스네어·림샷 테크닉 음악연습실](/stories/practice-room-drum-snare1) | [기타 왼손 비브라토·핑거 비브라토 음악연습실](/stories/practice-room-guitar-finger-vibrato1) | [피아노 루바토·음악적 템포 표현 음악연습실](/stories/practice-room-piano-rubato1) | [베이스 이펙터·페달 보드 활용 음악연습실](/stories/practice-room-bass-effects1) | [보컬 크루닝·저음 보컬 테크닉 음악연습실](/stories/practice-room-vocal-crooning1) | [피아노 소나타·클래식 소나타 형식 연습 음악연습실](/stories/practice-room-piano-sonata1) | [기타 재즈 코드·재즈 보이싱 음악연습실](/stories/practice-room-guitar-jazz-chord1) | [드럼 빠른 템포·스피드 훈련 음악연습실](/stories/practice-room-drum-speed1) | [보컬 중음역 강화·미들 보이스 음악연습실](/stories/practice-room-vocal-middle1) | [피아노 에튀드·기법 연습곡 음악연습실](/stories/practice-room-piano-etude1) | [기타 오픈 튜닝·슬라이드 오픈 튜닝 음악연습실](/stories/practice-room-guitar-open-tuning1) | [보컬 앙상블·코러스 개인 파트 훈련 음악연습실](/stories/practice-room-vocal-ensemble1) | [베이스 픽 주법·픽 베이스 연습 음악연습실](/stories/practice-room-bass-pick1) | [드럼 카운트·리듬 카운팅 훈련 음악연습실](/stories/practice-room-drum-count1) | [피아노 반음계·크로매틱 스케일 음악연습실](/stories/practice-room-piano-chromatic1) | [기타 핑거링 스트레칭·손가락 유연성 음악연습실](/stories/practice-room-guitar-stretch1) | [보컬 피치 컨트롤·음정 정확도 고급 훈련 음악연습실](/stories/practice-room-vocal-pitch1) | [베이스 슬라이드·포르타멘토 베이스 음악연습실](/stories/practice-room-bass-slide1) | [피아노 다이나믹·강약 표현 음악연습실](/stories/practice-room-piano-dynamics1) | [드럼 고스트 노트·유령음 훈련 음악연습실](/stories/practice-room-drum-ghost1) | [기타 코드 아르페지오·코드 분산 연주 음악연습실](/stories/practice-room-guitar-chord-arpeggio1) | [보컬 구음·솔페지오 훈련 음악연습실](/stories/practice-room-vocal-solfege1) | [피아노 폴리포니·독립 성부 연주 음악연습실](/stories/practice-room-piano-polyphony1) | [기타 리프·반복 패턴 작성 음악연습실](/stories/practice-room-guitar-riff1) | [드럼 오프비트·엇박 리듬 훈련 음악연습실](/stories/practice-room-drum-offbeat1) | [보컬 호흡 발음·자음 명료도 훈련 음악연습실](/stories/practice-room-vocal-consonant1) | [피아노 전조·조바꿈 연습 음악연습실](/stories/practice-room-piano-modulation1) | [기타 핑거피킹 패턴 다양화 음악연습실](/stories/practice-room-guitar-fingerpick-pattern1) | [베이스 뮤팅·노이즈 컨트롤 음악연습실](/stories/practice-room-bass-muting1) | [드럼 더블킥·더블 베이스 드럼 훈련 음악연습실](/stories/practice-room-drum-doublekick1) | [피아노 재즈 스탠다드·재즈 레퍼토리 음악연습실](/stories/practice-room-piano-jazz-standard1) | [보컬 라이브 퍼포먼스·공연 전 루틴 음악연습실](/stories/practice-room-vocal-live1) | [기타 뮤직 메모리·악보 없이 연주하기 음악연습실](/stories/practice-room-guitar-memory1) | [피아노 연속 도약·넓은 음정 점프 음악연습실](/stories/practice-room-piano-leaps1) | [드럼 크레셴도·다이나믹 빌드업 음악연습실](/stories/practice-room-drum-buildup1) | [베이스 펜타토닉·베이스 스케일 활용 음악연습실](/stories/practice-room-bass-pentatonic1) | [보컬 감정 표현·가사 해석 훈련 음악연습실](/stories/practice-room-vocal-emotion1) | [기타 해머온·풀오프 연속 훈련 음악연습실](/stories/practice-room-guitar-hammer-pull1) | [피아노 내성부·보조 선율 연습 음악연습실](/stories/practice-room-piano-inner-voice1) | [드럼 림샷·크로스스틱 고급 훈련 음악연습실](/stories/practice-room-drum-rimshot-adv1) | [보컬 뮤지컬 스타일·역할 보컬 훈련 음악연습실](/stories/practice-room-vocal-musical-style1) | [베이스 슬랩·팝핑 고급 테크닉 음악연습실](/stories/practice-room-bass-slap-adv1) | [피아노 초견 고급·빠른 악보 읽기 음악연습실](/stories/practice-room-piano-sight-adv1) | [드럼 타이밍·포켓 그루브 훈련 음악연습실](/stories/practice-room-drum-timing1) | [보컬 호흡·성대 컨트롤 고급 훈련 음악연습실](/stories/practice-room-vocal-breath-adv1) | [기타 비브라토·피치 컨트롤 음악연습실](/stories/practice-room-guitar-vibrato1) | [피아노 화성·코드 고급 이론 음악연습실](/stories/practice-room-piano-chord-adv1) | [재즈 베이스·워킹 베이스 고급 음악연습실](/stories/practice-room-bass-jazz1) | [보컬 음색 개발·개성 있는 목소리 훈련 음악연습실](/stories/practice-room-vocal-color-adv1) | [드럼 선형 리듬·리니어 드러밍 음악연습실](/stories/practice-room-drum-linear1) | [피아노 고급 테크닉·연주 기법 종합 음악연습실](/stories/practice-room-piano-technique-adv1) | [기타 코드 고급·확장 코드 연주 음악연습실](/stories/practice-room-guitar-chord-adv1) | [보컬 레지스터·성구 전환 훈련 음악연습실](/stories/practice-room-vocal-register1) | [베이스 루트 노트·코드 읽기 고급 음악연습실](/stories/practice-room-bass-root-adv1) | [피아노 터치·아티큘레이션 훈련 음악연습실](/stories/practice-room-piano-touch1) | [재즈 드럼 고급·스윙 필 심화 음악연습실](/stories/practice-room-drum-jazz-adv1) | [보컬 무대 퍼포먼스 고급·스테이지 존재감 음악연습실](/stories/practice-room-vocal-stage-adv1) | [기타 즉흥 연주·임프로비제이션 음악연습실](/stories/practice-room-guitar-improv1) | [성인 피아노 입문·처음 시작하는 어른 음악연습실](/stories/practice-room-piano-beginner-adult1) | [드럼 악센트·강세 패턴 훈련 음악연습실](/stories/practice-room-drum-accent1) | [베이스 옥타브 주법·옥타브 그루브 음악연습실](/stories/practice-room-bass-octave1) | [피아노 음정·인터벌 훈련 음악연습실](/stories/practice-room-piano-interval1) | [보컬 오디션 준비·심사 기준 이해 음악연습실](/stories/practice-room-vocal-audition1) | [기타 핑거스타일 고급 테크닉 음악연습실](/stories/practice-room-guitar-fingerstyle-adv1) | [베이스 플래절렛·하모닉스 주법 음악연습실](/stories/practice-room-bass-harmonic1) | [피아노 페달 테크닉·소스텐우토 음악연습실](/stories/practice-room-piano-pedal1) | [피아노 스케일·아르페지오 고급 훈련 음악연습실](/stories/practice-room-piano-scale-adv1) | [베이스 타핑·투핸드 테크닉 음악연습실](/stories/practice-room-bass-tapping1) | [보컬 리듬·박자감 훈련 음악연습실](/stories/practice-room-vocal-rhythm1) | [기타 재즈 보이싱·코드 멜로디 음악연습실](/stories/practice-room-guitar-jazz-voicing1) | [피아노 즉흥 연주·재즈 피아노 음악연습실](/stories/practice-room-piano-jazz1) | [보컬 코러스·하모니 훈련 음악연습실](/stories/practice-room-vocal-harmony1) | [드럼 더블 킥·더블 페달 훈련 음악연습실](/stories/practice-room-drum-double-kick1) | [보컬 마이크 테크닉·PA 활용 음악연습실](/stories/practice-room-vocal-mic1) | [피아노 협주곡·오케스트라 반주 연습 음악연습실](/stories/practice-room-piano-concerto1) | [드럼 필인·트랜지션 고급 훈련 음악연습실](/stories/practice-room-drum-fill-adv1) | [베이스 컨트리·록어빌리 주법 음악연습실](/stories/practice-room-bass-country1) | [기타 피킹 테크닉 고급 훈련 음악연습실](/stories/practice-room-guitar-picking-adv1) | [보컬 발음·딕션 훈련 음악연습실](/stories/practice-room-vocal-diction1) | [드럼 메트로놈·그루브 타이밍 훈련 음악연습실](/stories/practice-room-drum-metronome1) | [베이스 앙상블·밴드 연주 음악연습실](/stories/practice-room-bass-ensemble1) | [기타 블루스 스타일·블루스 표현 음악연습실](/stories/practice-room-guitar-blues1) | [보컬 인디·포크 스타일 음악연습실](/stories/practice-room-vocal-indie1) | [드럼 림샷·고스트노트 테크닉 음악연습실](/stories/practice-room-drum-rimshot1) | [베이스 워킹베이스·재즈 라인 음악연습실](/stories/practice-room-bass-walking1) | [기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-fingerpicking1) | [피아노 리드시트·즉흥 반주 음악연습실](/stories/practice-room-piano-leadsheet1) | [베이스 슬랩·팝핑 테크닉 음악연습실](/stories/practice-room-bass-slap1) | [기타 코드 전환 속도·스무스 체인지 음악연습실](/stories/practice-room-guitar-chord-change1) | [드럼 스네어 튜닝·드럼 헤드 세팅 음악연습실](/stories/practice-room-drum-snare-tuning1) | [보컬 브레스 컨트롤·호흡 훈련 음악연습실](/stories/practice-room-vocal-breath1) | [피아노 조표·조성 이해 음악연습실](/stories/practice-room-piano-key-signature1) | [기타 스트러밍 패턴·리듬 연주 음악연습실](/stories/practice-room-guitar-strumming1) | [드럼 재즈 라이드·스윙 패턴 음악연습실](/stories/practice-room-drum-jazz-ride1) | [연신내 음악연습실 안내](/stories/practice-room-yeonsinnae1) | [스튜디오 놀 이용 요금](/pricing)
