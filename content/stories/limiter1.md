---
title: "리미터 완전 가이드 — 마스터링 리미터 설정과 스트리밍 음압 확보"
date: 2026-04-06
author: "스튜디오 놀"
category: "녹음 가이드"
tags: ["리미터", "limiter", "마스터링 리미터", "트루피크", "LUFS", "음압 확보", "스트리밍 마스터링"]
thumbnail: "/images/service3.webp"
summary: "마스터링 리미터 완전 가이드. 리미터와 컴프레서의 차이, True Peak 설정, 스트리밍 플랫폼 LUFS 기준, 추천 리미터 플러그인까지 마스터링 마지막 단계를 완벽히 안내합니다."
faq:
  - q: "리미터와 컴프레서는 어떻게 다른가요?"
    a: "컴프레서는 Ratio를 2:1~8:1 정도로 설정해 다이나믹을 부드럽게 줄이고, 리미터는 Ratio를 무한대(∞:1)로 설정해 설정한 천장(Ceiling) 이상으로 신호가 절대 넘어가지 않게 막습니다. 마스터링 마지막 단계에서 음압을 최대화할 때 사용합니다."
  - q: "True Peak -1dBFS는 왜 지켜야 하나요?"
    a: "스트리밍 플랫폼(스포티파이, 애플뮤직, 유튜브)에서 음원을 디코딩할 때 실제 피크가 0dBFS를 초과하면 찌그러짐이 발생할 수 있습니다. -1dBFS True Peak는 이 여유를 확보하는 업계 표준입니다."
  - q: "스포티파이와 유튜브의 LUFS 기준은 다른가요?"
    a: "스포티파이: -14 LUFS, 유튜브: -14 LUFS, 애플뮤직: -16 LUFS, 사운드클라우드: -8~-12 LUFS가 기준입니다. 너무 크게 마스터링하면 플랫폼에서 자동으로 음량을 낮추므로 -14 LUFS를 목표로 하는 것이 일반적입니다."
  - q: "추천 리미터 플러그인은 무엇인가요?"
    a: "무료: TDR Limiter 6 GE (데모), Limiter No6. 유료: FabFilter Pro-L2, iZotope Ozone Maximizer, Waves L2. 입문자에게는 FabFilter Pro-L2가 시각적 피드백이 직관적이어서 추천합니다."
---
![리미터 완전 가이드 — 스튜디오 놀](/images/service3.webp)

## 마스터링의 마지막 문지기

리미터는 마스터링 체인의 마지막에 위치해 음원이 디지털 천장(0dBFS)을 넘지 않도록 막고, 스트리밍 플랫폼에 적합한 음압을 확보합니다.

---

## 리미터 기본 파라미터

| 파라미터 | 역할 | 마스터링 권장값 |
|--------|------|------------|
| Input Gain / Drive | 리미터에 들어가는 신호 레벨 | 원하는 LUFS 목표에 맞게 올리기 |
| Ceiling (출력 상한) | 신호가 절대 넘지 않을 최대 레벨 | -1.0dBFS (True Peak) |
| Lookahead | 미래 신호를 미리 보고 반응 | 1~3ms |
| Release | 리미팅 후 신호 회복 속도 | 100~300ms (장르에 따라) |

---

## 스트리밍 플랫폼별 음압 기준

버스로 묶어 처리하면 개별 트랙 조정 없이도 전체 밸런스를 효율적으로 잡을 수 있습니다.

### 플랫폼별 타겟 LUFS

- **스포티파이**: -14 LUFS (Integrated)
- **유튜브**: -14 LUFS
- **애플뮤직/아이튠즈**: -16 LUFS
- **타이달(Tidal)**: -14 LUFS
- **사운드클라우드**: 권장 -8~-12 LUFS

### True Peak 기준

- **모든 플랫폼 공통**: -1.0dBFS True Peak 이하

### 전략

- -14 LUFS를 목표로 마스터링 시 대부분 플랫폼에서
  음압이 낮춰지지 않음
- -8 LUFS 이상으로 올리면 플랫폼에서 -14로 자동 낮춤
  - 결과적으로 음질만 손해

---

## 마스터링 리미터 설정 절차

같은 플러그인이라도 신호 체인의 어느 위치에 두느냐에 따라 결과가 크게 달라집니다.

### 단계별 설정

1. 리미터 앞 EQ, 컴프레서, 새추레이션 등 처리 완료
2. 리미터 Ceiling: -1.0dBFS (True Peak) 설정
3. Input Gain을 천천히 올리면서 LUFS 미터 확인
  - **타겟**: -14 LUFS (Integrated)
4. Gain Reduction (GR) 확인
   - GR -3dB 이하: 음원이 이미 충분히 조용함 (정상)
   - GR -6~-10dB: 큰 피크 처리 중 (적절)
   - GR -15dB 이상: 너무 과도한 리미팅 → 믹스 재검토

5. Loudness Meter로 최종 확인
   - Integrated LUFS: -14 (스포티파이 기준)
   - True Peak: -1.0dBFS 이하
   - Short-term/Momentary LUFS도 참고

---

## 리미터 추천 플러그인

| 플러그인 | 특징 | 가격대 |
|--------|------|------|
| FabFilter Pro-L2 | 직관적 UI, True Peak 정확 | 유료 |
| iZotope Ozone Maximizer | AI 어시스턴트 포함 | 유료 |
| Waves L2 | 업계 표준, 안정적 | 유료 |
| TDR Limiter 6 GE | 투명한 리미팅 | 유료(데모 무료) |
| Limiter No6 | 무료, 멀티스테이지 | 무료 |

---

## 마치며

리미터 설정은 마스터링의 마지막 단계이지만, 그 전 믹싱과 마스터링 처리가 잘 돼 있어야 리미터도 제 역할을 합니다.

---

[스템 마스터링 완전 가이드](/stories/stem-mastering1) | [마스터링 완전 가이드](/stories/mastering1) | [음압(LUFS) 스트리밍 마스터링 가이드](/stories/loudness1) | [게인 스테이징 완전 가이드](/stories/gain-staging1) | [피아노 리듬감·리듬 훈련 음악연습실](/stories/practice-room-piano-rhythm1) | [기타 트레몰로·웜바 암 테크닉 음악연습실](/stories/practice-room-guitar-whammy1) | [보컬 다이나믹스·크레셴도 데크레셴도 음악연습실](/stories/practice-room-vocal-dynamics1) | [기타 줄 교체·스트링 선택 음악연습실](/stories/practice-room-guitar-string1) | [드럼 브러쉬·와이어 브러쉬 연주 음악연습실](/stories/practice-room-drum-brush1) | [피아노 즉흥 반주·코드 반주 음악연습실](/stories/practice-room-piano-sight-play1) | [베이스 코드·화음 연주 음악연습실](/stories/practice-room-bass-chord1) | [보컬 팔세토·가성 발성 음악연습실](/stories/practice-room-vocal-falsetto1) | [기타 탭핑·투핸드 태핑 음악연습실](/stories/practice-room-guitar-tapping1) | [피아노 듀엣·앙상블 개인 연습 음악연습실](/stories/practice-room-piano-duet1) | [드럼 폴리리듬·복잡박자 연습 음악연습실](/stories/practice-room-drum-polyrhythm1) | [보컬 어질리티·빠른 음계 훈련 음악연습실](/stories/practice-room-vocal-agility1) | [재즈 피아노 즉흥 솔로·임프로비제이션 음악연습실](/stories/practice-room-piano-jazz-improv1) | [기타 레가토·해머온 풀오프 연습 음악연습실](/stories/practice-room-guitar-legato1) | [베이스 펑크·R&B 그루브 음악연습실](/stories/practice-room-bass-funk1) | [보컬 프로젝션·소리 울림 훈련 음악연습실](/stories/practice-room-vocal-projection1) | [피아노 옥타브·넓은 음정 도약 연습 음악연습실](/stories/practice-room-piano-technique31) | [기타 슬라이드·슬라이드 기타 연습 음악연습실](/stories/practice-room-guitar-slide1) | [보컬 스타일 개발·장르별 창법 음악연습실](/stories/practice-room-vocal-style1) | [통기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-acoustic-fingerpick1) | [드럼 하이햇·심벌 컨트롤 음악연습실](/stories/practice-room-drum-hihat1) | [피아노 트릴·장식음 기법 음악연습실](/stories/practice-room-piano-trills1) | [기타 코드 진행·화성 이해 음악연습실](/stories/practice-room-guitar-chord-prog1) | [장르별 보컬 특성·크로스오버 보컬 음악연습실](/stories/practice-room-vocal-genre1) | [베이스 썸피킹·핑거스타일 혼합 음악연습실](/stories/practice-room-bass-thumb1) | [피아노 발라드 반주·감성 피아노 음악연습실](/stories/practice-room-piano-ballad21) | [기타 아르페지오·분산 화음 연습 음악연습실](/stories/practice-room-guitar-arpeggio1) | [보컬 녹음 준비·레코딩 보컬 음악연습실](/stories/practice-room-vocal-recording1) | [가스펠·CCM 피아노 반주 음악연습실](/stories/practice-room-piano-gospel1) | [기타 핑거스타일 고급·솔로 기타 편곡 음악연습실](/stories/practice-room-guitar-fingerpick-adv1) | [드럼 킥·베이스 드럼 테크닉 음악연습실](/stories/practice-room-drum-kick1) | [보컬 벨팅·파워 벨팅 음악연습실](/stories/practice-room-vocal-belting1) | [피아노 컴핑·재즈 반주 패턴 음악연습실](/stories/practice-room-piano-comping1) | [기타 피치카토·뮤트 주법 음악연습실](/stories/practice-room-guitar-mute1) | [베이스 핑거링·오른손 테크닉 음악연습실](/stories/practice-room-bass-fingering1) | [보컬 스타카토·단음 발성 훈련 음악연습실](/stories/practice-room-vocal-staccato1) | [드럼 심벌·크래쉬·라이드 테크닉 음악연습실](/stories/practice-room-drum-cymbal1) | [피아노 크로스 핸드·교차 손 훈련 음악연습실](/stories/practice-room-piano-crosshand1) | [기타 스케일 연습·포지션 이동 음악연습실](/stories/practice-room-guitar-scale-pos1) | [보컬 레가토·이어 부르기 훈련 음악연습실](/stories/practice-room-vocal-legato1) | [피아노 연탄·네 손 피아노 음악연습실](/stories/practice-room-piano-four-hands1) | [기타 핑거링·왼손 독립 훈련 음악연습실](/stories/practice-room-guitar-left-hand1) | [보컬 오버톤·배음 발성 훈련 음악연습실](/stories/practice-room-vocal-overtone1) | [드럼 스네어·림샷 테크닉 음악연습실](/stories/practice-room-drum-snare1) | [기타 왼손 비브라토·핑거 비브라토 음악연습실](/stories/practice-room-guitar-finger-vibrato1) | [피아노 루바토·음악적 템포 표현 음악연습실](/stories/practice-room-piano-rubato1) | [베이스 이펙터·페달 보드 활용 음악연습실](/stories/practice-room-bass-effects1) | [보컬 크루닝·저음 보컬 테크닉 음악연습실](/stories/practice-room-vocal-crooning1) | [피아노 소나타·클래식 소나타 형식 연습 음악연습실](/stories/practice-room-piano-sonata1) | [기타 재즈 코드·재즈 보이싱 음악연습실](/stories/practice-room-guitar-jazz-chord1) | [드럼 빠른 템포·스피드 훈련 음악연습실](/stories/practice-room-drum-speed1) | [보컬 중음역 강화·미들 보이스 음악연습실](/stories/practice-room-vocal-middle1) | [피아노 에튀드·기법 연습곡 음악연습실](/stories/practice-room-piano-etude1) | [기타 오픈 튜닝·슬라이드 오픈 튜닝 음악연습실](/stories/practice-room-guitar-open-tuning1) | [보컬 앙상블·코러스 개인 파트 훈련 음악연습실](/stories/practice-room-vocal-ensemble1) | [베이스 픽 주법·픽 베이스 연습 음악연습실](/stories/practice-room-bass-pick1) | [드럼 카운트·리듬 카운팅 훈련 음악연습실](/stories/practice-room-drum-count1) | [피아노 반음계·크로매틱 스케일 음악연습실](/stories/practice-room-piano-chromatic1) | [기타 핑거링 스트레칭·손가락 유연성 음악연습실](/stories/practice-room-guitar-stretch1) | [보컬 피치 컨트롤·음정 정확도 고급 훈련 음악연습실](/stories/practice-room-vocal-pitch1) | [베이스 슬라이드·포르타멘토 베이스 음악연습실](/stories/practice-room-bass-slide1) | [피아노 다이나믹·강약 표현 음악연습실](/stories/practice-room-piano-dynamics1) | [드럼 고스트 노트·유령음 훈련 음악연습실](/stories/practice-room-drum-ghost1) | [기타 코드 아르페지오·코드 분산 연주 음악연습실](/stories/practice-room-guitar-chord-arpeggio1) | [보컬 구음·솔페지오 훈련 음악연습실](/stories/practice-room-vocal-solfege1) | [피아노 폴리포니·독립 성부 연주 음악연습실](/stories/practice-room-piano-polyphony1) | [기타 리프·반복 패턴 작성 음악연습실](/stories/practice-room-guitar-riff1) | [드럼 오프비트·엇박 리듬 훈련 음악연습실](/stories/practice-room-drum-offbeat1) | [보컬 호흡 발음·자음 명료도 훈련 음악연습실](/stories/practice-room-vocal-consonant1) | [피아노 전조·조바꿈 연습 음악연습실](/stories/practice-room-piano-modulation1) | [기타 핑거피킹 패턴 다양화 음악연습실](/stories/practice-room-guitar-fingerpick-pattern1) | [베이스 뮤팅·노이즈 컨트롤 음악연습실](/stories/practice-room-bass-muting1) | [드럼 더블킥·더블 베이스 드럼 훈련 음악연습실](/stories/practice-room-drum-doublekick1) | [피아노 재즈 스탠다드·재즈 레퍼토리 음악연습실](/stories/practice-room-piano-jazz-standard1) | [보컬 라이브 퍼포먼스·공연 전 루틴 음악연습실](/stories/practice-room-vocal-live1) | [기타 뮤직 메모리·악보 없이 연주하기 음악연습실](/stories/practice-room-guitar-memory1) | [피아노 연속 도약·넓은 음정 점프 음악연습실](/stories/practice-room-piano-leaps1) | [드럼 크레셴도·다이나믹 빌드업 음악연습실](/stories/practice-room-drum-buildup1) | [베이스 펜타토닉·베이스 스케일 활용 음악연습실](/stories/practice-room-bass-pentatonic1) | [보컬 감정 표현·가사 해석 훈련 음악연습실](/stories/practice-room-vocal-emotion1) | [기타 해머온·풀오프 연속 훈련 음악연습실](/stories/practice-room-guitar-hammer-pull1) | [피아노 내성부·보조 선율 연습 음악연습실](/stories/practice-room-piano-inner-voice1) | [드럼 림샷·크로스스틱 고급 훈련 음악연습실](/stories/practice-room-drum-rimshot-adv1) | [보컬 뮤지컬 스타일·역할 보컬 훈련 음악연습실](/stories/practice-room-vocal-musical-style1) | [베이스 슬랩·팝핑 고급 테크닉 음악연습실](/stories/practice-room-bass-slap-adv1) | [피아노 초견 고급·빠른 악보 읽기 음악연습실](/stories/practice-room-piano-sight-adv1) | [드럼 타이밍·포켓 그루브 훈련 음악연습실](/stories/practice-room-drum-timing1) | [보컬 호흡·성대 컨트롤 고급 훈련 음악연습실](/stories/practice-room-vocal-breath-adv1) | [기타 비브라토·피치 컨트롤 음악연습실](/stories/practice-room-guitar-vibrato1) | [피아노 화성·코드 고급 이론 음악연습실](/stories/practice-room-piano-chord-adv1) | [재즈 베이스·워킹 베이스 고급 음악연습실](/stories/practice-room-bass-jazz1) | [보컬 음색 개발·개성 있는 목소리 훈련 음악연습실](/stories/practice-room-vocal-color-adv1) | [드럼 선형 리듬·리니어 드러밍 음악연습실](/stories/practice-room-drum-linear1) | [피아노 고급 테크닉·연주 기법 종합 음악연습실](/stories/practice-room-piano-technique-adv1) | [기타 코드 고급·확장 코드 연주 음악연습실](/stories/practice-room-guitar-chord-adv1) | [보컬 레지스터·성구 전환 훈련 음악연습실](/stories/practice-room-vocal-register1) | [베이스 루트 노트·코드 읽기 고급 음악연습실](/stories/practice-room-bass-root-adv1) | [피아노 터치·아티큘레이션 훈련 음악연습실](/stories/practice-room-piano-touch1) | [재즈 드럼 고급·스윙 필 심화 음악연습실](/stories/practice-room-drum-jazz-adv1) | [보컬 무대 퍼포먼스 고급·스테이지 존재감 음악연습실](/stories/practice-room-vocal-stage-adv1) | [기타 즉흥 연주·임프로비제이션 음악연습실](/stories/practice-room-guitar-improv1) | [성인 피아노 입문·처음 시작하는 어른 음악연습실](/stories/practice-room-piano-beginner-adult1) | [드럼 악센트·강세 패턴 훈련 음악연습실](/stories/practice-room-drum-accent1) | [베이스 옥타브 주법·옥타브 그루브 음악연습실](/stories/practice-room-bass-octave1) | [피아노 음정·인터벌 훈련 음악연습실](/stories/practice-room-piano-interval1) | [보컬 오디션 준비·심사 기준 이해 음악연습실](/stories/practice-room-vocal-audition1) | [기타 핑거스타일 고급 테크닉 음악연습실](/stories/practice-room-guitar-fingerstyle-adv1) | [베이스 플래절렛·하모닉스 주법 음악연습실](/stories/practice-room-bass-harmonic1) | [피아노 페달 테크닉·소스텐우토 음악연습실](/stories/practice-room-piano-pedal1) | [피아노 스케일·아르페지오 고급 훈련 음악연습실](/stories/practice-room-piano-scale-adv1) | [베이스 타핑·투핸드 테크닉 음악연습실](/stories/practice-room-bass-tapping1) | [보컬 리듬·박자감 훈련 음악연습실](/stories/practice-room-vocal-rhythm1) | [기타 재즈 보이싱·코드 멜로디 음악연습실](/stories/practice-room-guitar-jazz-voicing1) | [피아노 즉흥 연주·재즈 피아노 음악연습실](/stories/practice-room-piano-jazz1) | [보컬 코러스·하모니 훈련 음악연습실](/stories/practice-room-vocal-harmony1) | [드럼 더블 킥·더블 페달 훈련 음악연습실](/stories/practice-room-drum-double-kick1) | [보컬 마이크 테크닉·PA 활용 음악연습실](/stories/practice-room-vocal-mic1) | [피아노 협주곡·오케스트라 반주 연습 음악연습실](/stories/practice-room-piano-concerto1) | [드럼 필인·트랜지션 고급 훈련 음악연습실](/stories/practice-room-drum-fill-adv1) | [베이스 컨트리·록어빌리 주법 음악연습실](/stories/practice-room-bass-country1) | [기타 피킹 테크닉 고급 훈련 음악연습실](/stories/practice-room-guitar-picking-adv1) | [보컬 발음·딕션 훈련 음악연습실](/stories/practice-room-vocal-diction1) | [드럼 메트로놈·그루브 타이밍 훈련 음악연습실](/stories/practice-room-drum-metronome1) | [베이스 앙상블·밴드 연주 음악연습실](/stories/practice-room-bass-ensemble1) | [기타 블루스 스타일·블루스 표현 음악연습실](/stories/practice-room-guitar-blues1) | [보컬 인디·포크 스타일 음악연습실](/stories/practice-room-vocal-indie1) | [드럼 림샷·고스트노트 테크닉 음악연습실](/stories/practice-room-drum-rimshot1) | [베이스 워킹베이스·재즈 라인 음악연습실](/stories/practice-room-bass-walking1) | [기타 핑거피킹·핑거스타일 입문 음악연습실](/stories/practice-room-guitar-fingerpicking1) | [피아노 리드시트·즉흥 반주 음악연습실](/stories/practice-room-piano-leadsheet1) | [베이스 슬랩·팝핑 테크닉 음악연습실](/stories/practice-room-bass-slap1) | [기타 코드 전환 속도·스무스 체인지 음악연습실](/stories/practice-room-guitar-chord-change1) | [드럼 스네어 튜닝·드럼 헤드 세팅 음악연습실](/stories/practice-room-drum-snare-tuning1) | [보컬 브레스 컨트롤·호흡 훈련 음악연습실](/stories/practice-room-vocal-breath1) | [피아노 조표·조성 이해 음악연습실](/stories/practice-room-piano-key-signature1) | [기타 스트러밍 패턴·리듬 연주 음악연습실](/stories/practice-room-guitar-strumming1) | [드럼 재즈 라이드·스윙 패턴 음악연습실](/stories/practice-room-drum-jazz-ride1) | [베이스 루트·5도 패턴·기초 라인 음악연습실](/stories/practice-room-bass-root-fifth1) | [기타 핑거링·왼손 운지 훈련 음악연습실](/stories/practice-room-guitar-fingering1) | [베이스 서스테인·노트 컨트롤 음악연습실](/stories/practice-room-bass-sustain1) | [피아노 트레몰로·옥타브 트레몰로 음악연습실](/stories/practice-room-piano-tremolo1) | [연신내 음악연습실 안내](/stories/practice-room-yeonsinnae1) | [스튜디오 놀 이용 요금](/pricing)
