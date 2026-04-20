---
title: Cubase 보컬 녹음 완전 가이드 — Steinberg DAW로 스튜디오급 보컬
date: 2026-04-07T00:00:00.000Z
author: 스튜디오 놀
category: 녹음 가이드
tags:
  - Cubase 보컬
  - 큐베이스 녹음
  - Cubase 설정
  - Steinberg DAW
  - Cubase 믹싱
  - Cubase EQ
  - Cubase 컴프레서
thumbnail: /images/recording6.webp
summary: >-
  Cubase 보컬 녹음 완전 가이드입니다. Cubase 기본 설정·오디오 트랙 생성 및 녹음·Channel EQ 설정·Compressor
  설정·VariAudio — 내장 피치 교정·파일 내보내기 (Export)까지 정리합니다.
faq:
  - q: Cubase로 보컬 녹음이 가능한가요?
    a: >-
      가능합니다. Cubase는 Steinberg가 개발한 업계 표준 DAW로 전문 스튜디오에서도 널리 사용됩니다. 강력한 내장
      EQ·컴프레서와 VariAudio 피치 교정 기능으로 보컬 녹음·편집을 전문적으로 처리할 수 있습니다.
  - q: Cubase에서 오디오 인터페이스를 설정하는 방법은?
    a: >-
      Studio Setup (F4 또는 Studio → Studio Setup) → Audio System → ASIO
      Driver(Windows) 또는 Core Audio(Mac)를 오디오 인터페이스로 설정합니다. Studio → Studio
      Setup → VST Audio System에서도 확인합니다.
  - q: Cubase VariAudio란 무엇인가요?
    a: >-
      Cubase에 내장된 피치 교정 도구입니다. Sample Editor에서 활성화하면 보컬 음표를 시각적으로 편집할 수 있으며,
      Melodyne과 유사한 기능을 Cubase 내에서 별도 구매 없이 사용할 수 있습니다.
  - q: Cubase 보컬 파일을 어떻게 내보내나요?
    a: >-
      File → Export → Audio Mixdown (Ctrl+Shift+E) → Format: WAV → Bit Depth: 24
      bit → Sample Rate: 44100/48000 → Export Audio를 클릭합니다. 드라이 보컬은 플러그인 Bypass
      후 트랙 Solo → Export합니다.
---
![Cubase 보컬 녹음 완전 가이드 — 스튜디오 놀](/images/recording6.webp)

## Cubase — 30년 역사의 전문 DAW

Steinberg Cubase는 1989년부터 업계를 이끌어온 DAW로, 유럽 스튜디오와 클래식 음악 프로덕션에서 특히 많이 사용됩니다.

Cubase의 역사는 1989년 독일 Steinberg Media Technologies가 Atari ST 컴퓨터용 MIDI 시퀀서로 첫 버전을 출시하면서 시작됩니다. 1996년 VST(Virtual Studio Technology) 포맷을 세계 최초로 개발해 소프트웨어 플러그인 생태계의 기반을 만들었고, 이 VST 표준이 현재 전 세계 모든 DAW에서 사용하는 플러그인 포맷의 원형이 됐습니다. 2000년대 Cubase SX가 오디오 녹음·편집 기능을 강화하면서 유럽 클래식·영화 음악 스튜디오의 표준 DAW로 자리잡았습니다. 한국에서는 2000년대 중반부터 방송국·뮤지컬 제작사를 중심으로 도입됐고, 내장 피치 교정 도구 VariAudio와 Channel EQ의 정밀함이 K-POP 보컬 믹싱 환경에서도 인정받고 있습니다.

## Cubase 기본 설정

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

Cubase는 VariAudio 피치 교정과 정밀한 오디오 편집 기능으로 전문적인 보컬 작업에 최적화된 DAW입니다. 보컬 녹음 시 버퍼 크기는 64~256 samples로 설정해 레이턴시를 최소화하고, 믹싱 단계에서는 512~1024 samples로 높여 CPU 부하를 줄이는 것이 표준 워크플로우입니다. 다이렉트 모니터링은 오디오 인터페이스의 Direct Monitoring을 켜고 Cubase 소프트웨어 모니터링은 끄는 방식으로 설정해야 레이턴시 없이 실시간 모니터링이 가능합니다.

VariAudio에서 피치 교정 시 Straighten Pitch 슬라이더는 50~70% 수준을 권장합니다. 100%로 설정하면 Auto-Tune처럼 강한 피치 교정 효과가 나타나 부자연스러워집니다. 각 음표 블록을 직접 드래그해 이탈이 큰 음절만 선택적으로 교정하는 방식이 자연스러운 결과를 만듭니다.

믹싱 의뢰용 드라이 보컬 내보내기 시 Channel Inserts를 모두 Bypass하고 트랙을 Solo한 후 WAV 24bit/44.1kHz로 내보내는 것이 기본입니다. 이펙트가 적용된 상태로 내보내면 엔지니어가 EQ·컴프레서를 독립적으로 조정할 수 없어 믹싱 퀄리티에 제한이 생깁니다.

[Reaper 보컬 녹음 완전 가이드](/stories/reaper1) | [Studio One 보컬 녹음 완전 가이드](/stories/studioone1) | [Pro Tools 보컬 녹음 완전 가이드](/stories/protools1) | [음원 파일 형식 완전 가이드](/stories/audio-format1)
