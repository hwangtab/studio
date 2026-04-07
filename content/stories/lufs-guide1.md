---
title: "LUFS 완전 가이드 — 스트리밍 음압 기준과 마스터링 목표값 설정"
date: 2026-04-07
author: "스튜디오 놀"
category: "마스터링 가이드"
tags: ["LUFS", "음압", "스트리밍 음압", "LUFS 기준", "마스터링 음압", "Integrated LUFS", "True Peak"]
thumbnail: "/images/recording17.webp"
summary: "LUFS 완전 가이드입니다. Integrated LUFS·Short-term LUFS·Momentary LUFS의 차이, 스포티파이·애플뮤직·유튜브·멜론 플랫폼별 목표값..."
faq:
  - q: "LUFS란 무엇인가요?"
    a: "LUFS(Loudness Units relative to Full Scale)는 인간 청각 특성을 반영한 음량 단위입니다. 스트리밍 플랫폼이 자동 음량 정규화에 사용하는 기준값으로, 스포티파이·유튜브는 -14 LUFS, 애플뮤직은 -16 LUFS를 기준으로 조정합니다."
  - q: "Integrated LUFS와 Short-term LUFS의 차이는?"
    a: "Integrated LUFS는 곡 전체 구간의 평균 음량을 측정합니다. 스트리밍 정규화에 사용되는 값입니다. Short-term LUFS는 3초 단위 이동 평균, Momentary LUFS는 400ms 단위로 실시간 음량을 측정합니다. 마스터링 목표는 Integrated LUFS 기준입니다."
  - q: "마스터링 시 권장 LUFS 목표값은?"
    a: "일반적으로 스트리밍용 마스터링은 -14 LUFS (Integrated)를 기준으로 합니다. 단, 다이나믹이 중요한 클래식·재즈는 -18~-16 LUFS, 댄스·일렉트로닉은 -10~-8 LUFS로 장르에 따라 다릅니다. True Peak는 -1.0dBTP 이하가 원칙입니다."
  - q: "LUFS 측정 플러그인 추천은?"
    a: "대표적인 LUFS 측정 툴로는 Youlean Loudness Meter(무료), iZotope Insight, TC Electronic LM2n, Waves WLM Plus 등이 있습니다. DAW에 내장된 Loudness 미터도 활용 가능합니다. 측정 후 목표 LUFS에 맞게 마스터 리미터를 조정합니다."
---
![LUFS 완전 가이드 — 스튜디오 놀](/images/recording17.webp)

## LUFS — 스트리밍 음압의 기준

LUFS는 스트리밍 플랫폼이 음원 음량을 통일하는 국제 표준입니다.

---

## LUFS 유형별 차이

| 측정 유형 | 측정 구간 | 용도 |
|----------|----------|------|
| Integrated LUFS | 곡 전체 평균 | 스트리밍 정규화 기준 |
| Short-term LUFS | 3초 이동 평균 | 섹션별 음량 모니터링 |
| Momentary LUFS | 400ms 이동 평균 | 실시간 피크 모니터링 |
| LU Range (LRA) | 다이나믹 범위 측정 | 전체 다이나믹 확인 |
| True Peak | 샘플 간 피크 | 클리핑 방지 기준 |

---

## 플랫폼별 LUFS 기준

```
[스트리밍 플랫폼 음량 정규화 기준]

스포티파이:    -14 LUFS (Integrated) / True Peak -1.0dBTP
애플뮤직:      -16 LUFS (Integrated) / True Peak -1.0dBTP
유튜브:        -14 LUFS (Integrated) / True Peak -1.0dBTP
멜론·지니:     -14 LUFS 내외 (국내 플랫폼)
타이달:        -14 LUFS (Integrated)
아마존뮤직:    -14 LUFS (Integrated)

[기준 초과 시 처리]
→ 음원이 기준보다 크면 플랫폼이 자동으로 낮춤
→ 음원이 기준보다 작으면 일부 플랫폼에서 올림
→ 과도하게 압축된 음원은 낮춰도 다이나믹이 살아나지 않음
```

---

## 장르별 권장 LUFS

```
[장르별 Integrated LUFS 목표값]

팝·K-POP:          -14 LUFS ± 1
R&B·소울:          -14 ~ -16 LUFS
힙합:              -12 ~ -14 LUFS
댄스·EDM:          -10 ~ -12 LUFS
인디·포크:         -16 ~ -18 LUFS
클래식·재즈:       -18 ~ -23 LUFS
유튜브 콘텐츠:     -14 LUFS
팟캐스트·보이스:   -16 ~ -19 LUFS
```

---

## True Peak 설정

```
[True Peak 기준]
→ 스트리밍 납품: -1.0dBTP 이하
→ 방송 납품: -1.0dBTP ~ -3.0dBTP (방송사 기준 확인 필요)
→ CD 납품: -0.3dBTP 이하

[True Peak vs Sample Peak]
→ Sample Peak: DAW에서 보이는 일반 피크값
→ True Peak: 파일을 재생할 때 실제 발생하는 인터샘플 피크
→ True Peak가 더 실제 음량을 반영 (ISP 방지에 중요)
```

---

## 마스터링 헤드룸과 LUFS

```
[믹스 납품 → 마스터링 작업 흐름]

믹스 납품 기준:
→ Peak: -6dBFS 이하 헤드룸 확보
→ 리미터 OFF 상태로 납품

마스터링 처리:
① EQ: 최소 개입으로 주파수 밸런스 정리
② 컴프레서: Ratio 1.5:1~2:1, GR -1~-2dB
③ 멀티밴드 (필요 시)
④ 리미터: Ceiling -1.0dBTP, 목표 LUFS 달성

최종 납품 파일:
→ WAV 24bit/44.1kHz (스트리밍 원본)
→ MP3 320kbps (공유·미리듣기용)
→ Integrated LUFS 측정값 확인
```

---

## LUFS 측정 플러그인

| 플러그인 | 가격 | 특징 |
|---------|------|------|
| Youlean Loudness Meter | 무료 | LUFS/LRA/True Peak 측정 |
| iZotope Insight 2 | 유료 | 상세 분석·비교 기능 |
| Waves WLM Plus | 유료 | 방송 기준 준수 측정 |
| TC Electronic LM2n | 유료 | 하드웨어 기반 측정 |
| DAW 내장 Loudness | 무료 | 기본 측정 기능 |

---

## 마치며

LUFS 기준에 맞는 마스터링은 스트리밍 음원이 모든 플랫폼에서 일관된 음량으로 재생되도록 합니다.

---

[마스터링 완전 가이드](/stories/mastering1) | [마스터링 팁 완전 가이드](/stories/mastering-tips1) | [스템 마스터링 완전 가이드](/stories/stem-mastering1) | [음압(LUFS) 스트리밍 가이드](/stories/loudness1) | [온라인 믹싱 의뢰 방법](/stories/onlinemix1) | [스튜디오 놀 이용 요금](/pricing)
