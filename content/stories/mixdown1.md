---
title: "믹스 다운 완전 가이드 — DAW 최종 출력 설정과 유통사 스펙"
date: 2026-04-06
author: "스튜디오 놀"
category: "음반 제작 가이드"
tags: ["믹스 다운", "DAW 출력", "바운스", "음원 출력 설정", "샘플레이트 설정", "비트뎁스 설정", "음원 납품 형식"]
thumbnail: "/images/recording6.webp"
summary: "믹스 다운 완전 가이드입니다. DAW 최종 출력 설정(샘플레이트·비트뎁스·형식), 바운스 전 체크리스트, 유통사별 스펙, WAV·MP3·FLAC 선택 기준을 정리합니다."
faq:
  - q: "믹스 다운(Mix Down)이란 무엇인가요?"
    a: "DAW에서 작업한 여러 트랙을 하나의 스테레오 오디오 파일로 합치는 작업입니다. 바운스(Bounce) 또는 익스포트(Export)라고도 하며, 마스터링 단계 전 최종 믹스 파일을 만드는 과정입니다."
  - q: "믹스 다운 시 어떤 형식과 설정을 사용해야 하나요?"
    a: "마스터링·유통용은 WAV 24bit/44.1kHz 또는 48kHz, SNS 공유용은 MP3 320kbps를 사용합니다. 마스터링 전 납품용은 헤드룸 확보를 위해 -3~-6dBFS 이내로 출력하세요."
  - q: "바운스 전 반드시 확인해야 할 것은 무엇인가요?"
    a: "클리핑(빨간 피크) 없음, 마스터버스 리미터 해제 후 레벨 확인, 시작·끝 1~2초 여백, 샘플레이트·비트뎁스 설정, 파일명 정확성을 반드시 확인하세요."
  - q: "스트리밍 유통 시 어떤 LUFS로 출력해야 하나요?"
    a: "마스터링 후 기준으로 스포티파이·애플뮤직은 -14 LUFS, 유튜브는 -14 LUFS(-1dBTP)가 권장 기준입니다. 믹스 다운 단계에서는 헤드룸을 남겨두고, 마스터링에서 최종 음량을 맞추는 것이 원칙입니다."
---
![믹스 다운 완전 가이드 — 스튜디오 놀](/images/recording6.webp)

## 믹스 다운 — 완성 파일을 만드는 마지막 단계

믹싱이 완료된 후 DAW에서 올바른 설정으로 출력하는 것이 음원 유통과 마스터링 품질을 결정합니다.

---

## 출력 형식별 용도

| 형식 | 설정 | 용도 |
|------|------|------|
| WAV | 24bit/44.1kHz 또는 48kHz | 마스터링·유통 납품 |
| WAV | 16bit/44.1kHz | CD 배포 (레드북 표준) |
| FLAC | 24bit/44.1kHz | 무손실 유통사 납품 |
| MP3 | 320kbps | SNS·유튜브·일반 공유 |
| AAC | 256kbps | Apple Music·유튜브 자동 변환 |

---

## 바운스 전 체크리스트

계약서의 세부 조항을 꼼꼼히 확인하는 습관이 장기적으로 큰 손실을 막아줍니다.

### 믹스 확인

- 마스터버스 클리핑 없음 (피크미터 빨간 불 없음)
- 마스터버스 리미터 설정 확인
  - **마스터링 전 납품**: 리미터 제거 또는 Ceiling -3~-6dBFS
  - **최종 마스터**: Ceiling -1.0dBFS
- 레퍼런스 트랙과 최종 비교

### 출력 설정

- 샘플레이트: 48kHz (녹음 소스와 동일) 또는 44.1kHz (유통 목적)
- 비트뎁스: 24bit (마스터링 납품) / 16bit (CD 배포)
- 파일 형식: WAV (마스터링) / MP3 320kbps (공유)
- Dithering: 16bit로 낮출 때만 적용

### 파일 설정

- 파일명: [아티스트명]_[곡명]_mix.wav
- 시작 1~2초 여백 (클릭·팝 방지)
- 끝 1~2초 여백 (리버브 꼬리 포함)
- 저장 위치 확인

---

## DAW별 출력 방법

유통사 선택은 수수료뿐만 아니라 지원 서비스와 플랫폼 커버리지도 함께 고려하세요.

### Logic Pro

File → Bounce → Project or Section
- **PCM 선택**: WAV, 24bit, 44.1kHz 또는 48kHz
- **Normalize**: Off (마스터링 전)

### Ableton Live

File → Export Audio/Video
- **File Type**: WAV, Bit Depth: 24, Sample Rate: 44100/48000
- **Normalize**: Off

### Pro Tools

File → Bounce to → Disk
- **File Type**: WAV, Bit Depth: 24, Sample Rate: 44.1/48kHz
- **Import After Bounce**: 선택

### GarageBand (Mac)

Share → Export Song to Disk
- **Quality**: Lossless (AIFF 24bit)

---

## 유통사별 권장 스펙

스트리밍 데이터를 분석하면 마케팅 전략을 더욱 정밀하게 조정할 수 있습니다.

### 멜론·지니·벅스 (국내 스트리밍)

- WAV 16bit/44.1kHz 이상 (유통사에서 자체 변환)
- FLAC 24bit/44.1kHz 권장

### 스포티파이·애플뮤직 (글로벌 스트리밍)

- WAV 24bit/44.1kHz 또는 48kHz
- 플랫폼에서 -14 LUFS로 자동 정규화

### 유튜브

- WAV 또는 MP3 320kbps
- -14 LUFS(-1dBTP) 기준 자동 조정

### 최종 권장 납품 사양

- WAV 24bit/44.1kHz (마스터링 입력용)
- 마스터링 완료 후 유통사 스펙으로 변환

---

## 마치며

올바른 믹스 다운 설정이 마스터링과 유통 품질을 보장합니다.

---

[믹싱 워크플로우 완전 가이드](/stories/mixing-workflow1) | [음원 파일 형식 완전 가이드](/stories/audio-format1) | [마스터링 완전 가이드](/stories/mastering1) | [음원 유통 완전 가이드](/stories/music-distribution1) | [온라인 믹싱 의뢰 방법](/stories/onlinemix1) | [피아노 리듬감·리듬 훈련 음악연습실](/stories/practice-room-piano-rhythm1) | [기타 트레몰로·웜바 암 테크닉 음악연습실](/stories/practice-room-guitar-whammy1) | [보컬 다이나믹스·크레셴도 데크레셴도 음악연습실](/stories/practice-room-vocal-dynamics1) | [기타 줄 교체·스트링 선택 음악연습실](/stories/practice-room-guitar-string1) | [드럼 브러쉬·와이어 브러쉬 연주 음악연습실](/stories/practice-room-drum-brush1) | [피아노 즉흥 반주·코드 반주 음악연습실](/stories/practice-room-piano-sight-play1) | [베이스 코드·화음 연주 음악연습실](/stories/practice-room-bass-chord1) | [보컬 팔세토·가성 발성 음악연습실](/stories/practice-room-vocal-falsetto1) | [기타 탭핑·투핸드 태핑 음악연습실](/stories/practice-room-guitar-tapping1) | [피아노 듀엣·앙상블 개인 연습 음악연습실](/stories/practice-room-piano-duet1) | [드럼 폴리리듬·복잡박자 연습 음악연습실](/stories/practice-room-drum-polyrhythm1) | [보컬 어질리티·빠른 음계 훈련 음악연습실](/stories/practice-room-vocal-agility1) | [재즈 피아노 즉흥 솔로·임프로비제이션 음악연습실](/stories/practice-room-piano-jazz-improv1) | [기타 레가토·해머온 풀오프 연습 음악연습실](/stories/practice-room-guitar-legato1) | [베이스 펑크·R&B 그루브 음악연습실](/stories/practice-room-bass-funk1) | [보컬 프로젝션·소리 울림 훈련 음악연습실](/stories/practice-room-vocal-projection1) | [피아노 옥타브·넓은 음정 도약 연습 음악연습실](/stories/practice-room-piano-technique31) | [기타 슬라이드·슬라이드 기타 연습 음악연습실](/stories/practice-room-guitar-slide1) | [보컬 스타일 개발·장르별 창법 음악연습실](/stories/practice-room-vocal-style1) | [통기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-acoustic-fingerpick1) | [드럼 하이햇·심벌 컨트롤 음악연습실](/stories/practice-room-drum-hihat1) | [피아노 트릴·장식음 기법 음악연습실](/stories/practice-room-piano-trills1) | [기타 코드 진행·화성 이해 음악연습실](/stories/practice-room-guitar-chord-prog1) | [장르별 보컬 특성·크로스오버 보컬 음악연습실](/stories/practice-room-vocal-genre1) | [베이스 썸피킹·핑거스타일 혼합 음악연습실](/stories/practice-room-bass-thumb1) | [피아노 발라드 반주·감성 피아노 음악연습실](/stories/practice-room-piano-ballad21) | [기타 아르페지오·분산 화음 연습 음악연습실](/stories/practice-room-guitar-arpeggio1) | [보컬 녹음 준비·레코딩 보컬 음악연습실](/stories/practice-room-vocal-recording1) | [가스펠·CCM 피아노 반주 음악연습실](/stories/practice-room-piano-gospel1) | [기타 핑거스타일 고급·솔로 기타 편곡 음악연습실](/stories/practice-room-guitar-fingerpick-adv1) | [드럼 킥·베이스 드럼 테크닉 음악연습실](/stories/practice-room-drum-kick1) | [보컬 벨팅·파워 벨팅 음악연습실](/stories/practice-room-vocal-belting1) | [피아노 컴핑·재즈 반주 패턴 음악연습실](/stories/practice-room-piano-comping1) | [기타 피치카토·뮤트 주법 음악연습실](/stories/practice-room-guitar-mute1) | [베이스 핑거링·오른손 테크닉 음악연습실](/stories/practice-room-bass-fingering1) | [보컬 스타카토·단음 발성 훈련 음악연습실](/stories/practice-room-vocal-staccato1) | [드럼 심벌·크래쉬·라이드 테크닉 음악연습실](/stories/practice-room-drum-cymbal1) | [피아노 크로스 핸드·교차 손 훈련 음악연습실](/stories/practice-room-piano-crosshand1) | [기타 스케일 연습·포지션 이동 음악연습실](/stories/practice-room-guitar-scale-pos1) | [보컬 레가토·이어 부르기 훈련 음악연습실](/stories/practice-room-vocal-legato1) | [피아노 연탄·네 손 피아노 음악연습실](/stories/practice-room-piano-four-hands1) | [기타 핑거링·왼손 독립 훈련 음악연습실](/stories/practice-room-guitar-left-hand1) | [보컬 오버톤·배음 발성 훈련 음악연습실](/stories/practice-room-vocal-overtone1) | [드럼 스네어·림샷 테크닉 음악연습실](/stories/practice-room-drum-snare1) | [기타 왼손 비브라토·핑거 비브라토 음악연습실](/stories/practice-room-guitar-finger-vibrato1) | [피아노 루바토·음악적 템포 표현 음악연습실](/stories/practice-room-piano-rubato1) | [베이스 이펙터·페달 보드 활용 음악연습실](/stories/practice-room-bass-effects1) | [보컬 크루닝·저음 보컬 테크닉 음악연습실](/stories/practice-room-vocal-crooning1) | [피아노 소나타·클래식 소나타 형식 연습 음악연습실](/stories/practice-room-piano-sonata1) | [기타 재즈 코드·재즈 보이싱 음악연습실](/stories/practice-room-guitar-jazz-chord1) | [드럼 빠른 템포·스피드 훈련 음악연습실](/stories/practice-room-drum-speed1) | [보컬 중음역 강화·미들 보이스 음악연습실](/stories/practice-room-vocal-middle1) | [피아노 에튀드·기법 연습곡 음악연습실](/stories/practice-room-piano-etude1) | [기타 오픈 튜닝·슬라이드 오픈 튜닝 음악연습실](/stories/practice-room-guitar-open-tuning1) | [보컬 앙상블·코러스 개인 파트 훈련 음악연습실](/stories/practice-room-vocal-ensemble1) | [베이스 픽 주법·픽 베이스 연습 음악연습실](/stories/practice-room-bass-pick1) | [드럼 카운트·리듬 카운팅 훈련 음악연습실](/stories/practice-room-drum-count1) | [피아노 반음계·크로매틱 스케일 음악연습실](/stories/practice-room-piano-chromatic1) | [기타 핑거링 스트레칭·손가락 유연성 음악연습실](/stories/practice-room-guitar-stretch1) | [보컬 피치 컨트롤·음정 정확도 고급 훈련 음악연습실](/stories/practice-room-vocal-pitch1) | [연신내 음악연습실 안내](/stories/practice-room-yeonsinnae1) | [스튜디오 놀 이용 요금](/pricing)
