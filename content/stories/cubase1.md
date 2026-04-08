---
title: "Cubase 보컬 녹음 완전 가이드 — Steinberg DAW로 스튜디오급 보컬"
date: 2026-04-07
author: "스튜디오 놀"
category: "녹음 가이드"
tags: ["Cubase 보컬", "큐베이스 녹음", "Cubase 설정", "Steinberg DAW", "Cubase 믹싱", "Cubase EQ", "Cubase 컴프레서"]
thumbnail: "/images/portfolio2.webp"
summary: "Cubase 보컬 녹음 완전 가이드입니다. Cubase 기본 설정·오디오 트랙 생성 및 녹음·Channel EQ 설정·Compressor 설정·VariAudio — 내장 피치 교정·파일 내보내기 (Export)까지 정리합니다."
faq:
  - q: "Cubase로 보컬 녹음이 가능한가요?"
    a: "가능합니다. Cubase는 Steinberg가 개발한 업계 표준 DAW로 전문 스튜디오에서도 널리 사용됩니다. 강력한 내장 EQ·컴프레서와 VariAudio 피치 교정 기능으로 보컬 녹음·편집을 전문적으로 처리할 수 있습니다."
  - q: "Cubase에서 오디오 인터페이스를 설정하는 방법은?"
    a: "Studio Setup (F4 또는 Studio → Studio Setup) → Audio System → ASIO Driver(Windows) 또는 Core Audio(Mac)를 오디오 인터페이스로 설정합니다. Studio → Studio Setup → VST Audio System에서도 확인합니다."
  - q: "Cubase VariAudio란 무엇인가요?"
    a: "Cubase에 내장된 피치 교정 도구입니다. Sample Editor에서 활성화하면 보컬 음표를 시각적으로 편집할 수 있으며, Melodyne과 유사한 기능을 Cubase 내에서 별도 구매 없이 사용할 수 있습니다."
  - q: "Cubase 보컬 파일을 어떻게 내보내나요?"
    a: "File → Export → Audio Mixdown (Ctrl+Shift+E) → Format: WAV → Bit Depth: 24 bit → Sample Rate: 44100/48000 → Export Audio를 클릭합니다. 드라이 보컬은 플러그인 Bypass 후 트랙 Solo → Export합니다."
---
![Cubase 보컬 녹음 완전 가이드 — 스튜디오 놀](/images/portfolio2.webp)

## Cubase — 30년 역사의 전문 DAW

Steinberg Cubase는 1989년부터 업계를 이끌어온 DAW로, 유럽 스튜디오와 클래식 음악 프로덕션에서 특히 많이 사용됩니다.

---

## Cubase 기본 설정

이펙트를 추가하기 전에 원음의 문제를 먼저 해결하는 것이 올바른 순서입니다.

### 오디오 인터페이스 설정

1. 오디오 인터페이스 연결
2. Studio → Studio Setup (F4)
3. VST Audio System → ASIO Driver(Win) 또는 CoreAudio(Mac) 선택
4. 오디오 인터페이스 선택

### 버퍼·샘플레이트 설정

Studio Setup → Control Panel (Windows)
- Buffer Size: 녹음 시 64~256 samples
           믹싱 시 512~1024 samples
- Sample Rate: 44100Hz 또는 48000Hz

### 프로젝트 생성

File → New Project → Sample Rate 설정 → Create

---

## 오디오 트랙 생성 및 녹음

모노로 확인하면 스테레오에서 감춰진 문제를 더 빨리 발견할 수 있습니다.

### 트랙 생성

1. Project → Add Track → Audio
2. Configuration: Mono (보컬 단일 채널)
3. Input Routing: 오디오 인터페이스 입력 채널
4. Record Enable 버튼 클릭 (빨간 원)

### 게인 설정

- Input Level 미터: -12dBFS ~ -6dBFS 피크
- 클리핑 방지

### 다이렉트 모니터링

- 오디오 인터페이스 Direct Monitoring ON
- Cubase 소프트웨어 모니터링: OFF (레이턴시 방지)

### 녹음 시작

Numpad * 또는 Transport 녹음 버튼
Space 키로 정지

---

## Channel EQ 설정

바이패스로 전후 비교하는 습관이 과처리를 막는 가장 효과적인 방법입니다.

### Channel EQ 열기

트랙 헤더 → E(Edit Channel Settings) 클릭
- EQ 탭 활성화

### 기본 보컬 EQ

1. Low Cut (HPF): 80~100Hz
2. Low Mid: 300~500Hz, -2~-3dB (탁함)
3. High Mid: 2~4kHz, +1~2dB (명료도)
4. High (Shelf): 10kHz, +1dB (공기감)

### Spectrum Analyzer

EQ 창 내 Spectrum 버튼 ON → 실시간 확인
- **Q 값**: 높을수록 좁은 대역 (서지컬)

---

## Compressor 설정

같은 플러그인이라도 신호 체인의 어느 위치에 두느냐에 따라 결과가 크게 달라집니다.

### Compressor 삽입

Channel Insert 슬롯 → Dynamics → Compressor

### 기본 보컬 컴프레서 값

- Threshold: -18dB
- Ratio: 3:1
- Attack: 15ms
- Release: 100ms
- Make-up Gain: +3~5dB
- Soft Knee 활성화

### GR 미터 확인

- -3~-6dB 게인 리덕션: 적당
- Live 버튼으로 실시간 모니터링

---

## VariAudio — 내장 피치 교정

버스로 묶어 처리하면 개별 트랙 조정 없이도 전체 밸런스를 효율적으로 잡을 수 있습니다.

### VariAudio 활성화

1. 보컬 클립 더블클릭 → Sample Editor 열기
2. VariAudio 탭 클릭 → Analyze 클릭

### 피치 교정

- 각 음표 블록 표시 → 위아래 드래그로 교정
- Pitch & Warp 툴 선택
- Straighten Pitch: 0~100% 슬라이더 (100%=Auto-Tune 효과)
- 자연스러운 교정: 50~70% 권장

### 타이밍 교정

- VariAudio Warp 마커로 타이밍 교정 가능

---

## 파일 내보내기 (Export)

각 파라미터가 사운드에 미치는 영향을 이해하면 설정값을 외우지 않아도 귀로 판단할 수 있습니다.

### Audio Mixdown 내보내기

File → Export → Audio Mixdown (Ctrl+Shift+E)
- **File Format**: WAV
- **Bit Depth**: 24 Bit
- **Sample Rate**: 44100Hz 또는 48000Hz
- **Channel Selection**: 트랙 Solo 확인
- Export Audio 클릭

### 드라이 보컬 내보내기

1. 보컬 트랙 Solo
2. Channel Inserts 전체 Bypass
3. Audio Mixdown → WAV 24bit

### 파일 전달

- **파일명**: [아티스트명]_[곡명]_vocal.wav

---

## 마치며

Cubase는 VariAudio 피치 교정과 정밀한 오디오 편집 기능으로 전문적인 보컬 작업에 최적화된 DAW입니다.

---

[Reaper 보컬 녹음 완전 가이드](/stories/reaper1) | [Studio One 보컬 녹음 완전 가이드](/stories/studioone1) | [Pro Tools 보컬 녹음 완전 가이드](/stories/protools1) | [음원 파일 형식 완전 가이드](/stories/audio-format1) | [온라인 믹싱 의뢰 방법](/stories/onlinemix1) | [피아노 리듬감·리듬 훈련 음악연습실](/stories/practice-room-piano-rhythm1) | [기타 트레몰로·웜바 암 테크닉 음악연습실](/stories/practice-room-guitar-whammy1) | [보컬 다이나믹스·크레셴도 데크레셴도 음악연습실](/stories/practice-room-vocal-dynamics1) | [기타 줄 교체·스트링 선택 음악연습실](/stories/practice-room-guitar-string1) | [드럼 브러쉬·와이어 브러쉬 연주 음악연습실](/stories/practice-room-drum-brush1) | [피아노 즉흥 반주·코드 반주 음악연습실](/stories/practice-room-piano-sight-play1) | [베이스 코드·화음 연주 음악연습실](/stories/practice-room-bass-chord1) | [보컬 팔세토·가성 발성 음악연습실](/stories/practice-room-vocal-falsetto1) | [기타 탭핑·투핸드 태핑 음악연습실](/stories/practice-room-guitar-tapping1) | [피아노 듀엣·앙상블 개인 연습 음악연습실](/stories/practice-room-piano-duet1) | [드럼 폴리리듬·복잡박자 연습 음악연습실](/stories/practice-room-drum-polyrhythm1) | [보컬 어질리티·빠른 음계 훈련 음악연습실](/stories/practice-room-vocal-agility1) | [재즈 피아노 즉흥 솔로·임프로비제이션 음악연습실](/stories/practice-room-piano-jazz-improv1) | [기타 레가토·해머온 풀오프 연습 음악연습실](/stories/practice-room-guitar-legato1) | [베이스 펑크·R&B 그루브 음악연습실](/stories/practice-room-bass-funk1) | [보컬 프로젝션·소리 울림 훈련 음악연습실](/stories/practice-room-vocal-projection1) | [피아노 옥타브·넓은 음정 도약 연습 음악연습실](/stories/practice-room-piano-technique31) | [기타 슬라이드·슬라이드 기타 연습 음악연습실](/stories/practice-room-guitar-slide1) | [보컬 스타일 개발·장르별 창법 음악연습실](/stories/practice-room-vocal-style1) | [통기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-acoustic-fingerpick1) | [드럼 하이햇·심벌 컨트롤 음악연습실](/stories/practice-room-drum-hihat1) | [피아노 트릴·장식음 기법 음악연습실](/stories/practice-room-piano-trills1) | [연신내 음악연습실 안내](/stories/practice-room-yeonsinnae1) | [스튜디오 놀 이용 요금](/pricing)
