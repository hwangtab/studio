---
title: 믹스 다운 완전 가이드 — DAW 최종 출력 설정과 유통사 스펙
date: 2026-04-06T00:00:00.000Z
author: 스튜디오 놀
category: 음악 제작
tags:
  - 믹스 다운
  - DAW 출력
  - 바운스
  - 음원 출력 설정
  - 샘플레이트 설정
  - 비트뎁스 설정
  - 음원 납품 형식
thumbnail: /images/recording6.webp
summary: >-
  믹스 다운 완전 가이드입니다. DAW 최종 출력 설정(샘플레이트·비트뎁스·형식), 바운스 전 체크리스트, 유통사별 스펙,
  WAV·MP3·FLAC 선택 기준을 정리합니다.
faq:
  - q: 믹스 다운(Mix Down)이란 무엇인가요?
    a: >-
      DAW에서 작업한 여러 트랙을 하나의 스테레오 오디오 파일로 합치는 작업입니다. 바운스(Bounce) 또는
      익스포트(Export)라고도 하며, 마스터링 단계 전 최종 믹스 파일을 만드는 과정입니다.
  - q: 믹스 다운 시 어떤 형식과 설정을 사용해야 하나요?
    a: >-
      마스터링·유통용은 WAV 24bit/44.1kHz 또는 48kHz, SNS 공유용은 MP3 320kbps를 사용합니다. 마스터링 전
      납품용은 헤드룸 확보를 위해 -3~-6dBFS 이내로 출력하세요.
  - q: 바운스 전 반드시 확인해야 할 것은 무엇인가요?
    a: >-
      클리핑(빨간 피크) 없음, 마스터버스 리미터 해제 후 레벨 확인, 시작·끝 1~2초 여백, 샘플레이트·비트뎁스 설정, 파일명 정확성을
      반드시 확인하세요.
  - q: 스트리밍 유통 시 어떤 LUFS로 출력해야 하나요?
    a: >-
      마스터링 후 기준으로 스포티파이·애플뮤직은 -14 LUFS, 유튜브는 -14 LUFS(-1dBTP)가 권장 기준입니다. 믹스 다운
      단계에서는 헤드룸을 남겨두고, 마스터링에서 최종 음량을 맞추는 것이 원칙입니다.
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

[믹싱 워크플로우 완전 가이드](/stories/mixing-workflow1) | [음원 파일 형식 완전 가이드](/stories/audio-format1) | [마스터링 완전 가이드](/stories/mastering1) | [음원 유통 완전 가이드](/stories/music-distribution1) | [온라인 믹싱 의뢰 방법](/stories/onlinemix1)
