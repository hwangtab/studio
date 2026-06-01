# 네이버 서치어드바이저 수집요청 우선순위 URL 목록

> 작성 2026-05-31. 네이버 색인 커버리지 25%(390/1571) → 핵심 페이지부터 수동 수집요청으로 가속.
> 경로: **네이버 서치어드바이저 → 요청 → 웹 페이지 수집** 에 아래 URL을 위에서부터 복붙 제출.
> 하루 수집요청 할당량이 제한적이므로 **티어 1 → 2 → 3 순서**로 며칠 나눠 제출.

---

## 제출 원칙

- 모든 URL은 실제 존재 확인 완료(2026-05-31).
- 전환 가치 + 네이버 강세(연습실·월세·로컬) + 검색 수요 순으로 정렬.
- 이미 색인된 페이지를 다시 요청해도 무방(갱신 신호).
- 동시에 **RSS 제출**(요청 → RSS 제출)에 `https://studionol.co.kr/api/rss?locale=ko` 등록하면 새 글 자동 수집.

---

## 🥇 티어 1 — 전환 직결 핵심 페이지 (최우선, 첫날)

```
https://studionol.co.kr/ko/practice-room
https://studionol.co.kr/ko/pricing
https://studionol.co.kr/ko/voice-acting
https://studionol.co.kr/ko/wedding-song
https://studionol.co.kr/ko
https://studionol.co.kr/ko/about
https://studionol.co.kr/ko/portfolio
https://studionol.co.kr/ko/studio-info
https://studionol.co.kr/ko/lesson
https://studionol.co.kr/ko/contact
```

> 근거: practice-room은 네이버 클릭 1위(30클릭/511노출). pricing·voice-acting·wedding-song은 의뢰 직결. about은 방금 대표 소개 추가됨.

---

## 🥈 티어 2 — 네이버 강세 클러스터 (연습실·월세·로컬)

```
https://studionol.co.kr/ko/stories/practice-room-monthly1
https://studionol.co.kr/ko/stories/practice-room-startup1
https://studionol.co.kr/ko/stories/practice-room-yeonsinnae1
https://studionol.co.kr/ko/stories/seoul1
https://studionol.co.kr/ko/stories/recording-price1
```

> 근거: 네이버 상위 키워드가 "음악작업실 월세·신디사이저 연습실·연신내 녹음실 월대여·음악연습실 월세". 연습실·월세·지역 의도가 네이버에서 가장 강함.

---

## 🥉 티어 3 — 검색 수요 높은 의뢰의도 스토리

```
https://studionol.co.kr/ko/stories/revenue1
https://studionol.co.kr/ko/stories/distribution1
https://studionol.co.kr/ko/stories/vocal-microphone1
https://studionol.co.kr/ko/stories/noise-reduction1
https://studionol.co.kr/ko/stories/song-key1
https://studionol.co.kr/ko/stories/daw-choice1
https://studionol.co.kr/ko/stories/mixvoice1
https://studionol.co.kr/ko/stories/highnote1
https://studionol.co.kr/ko/stories/eq1
https://studionol.co.kr/ko/stories/mastering1
https://studionol.co.kr/ko/stories/songstructure1
https://studionol.co.kr/ko/stories/copyright-cover1
https://studionol.co.kr/ko/stories/audioformat1
https://studionol.co.kr/ko/stories/loudness1
https://studionol.co.kr/ko/stories/delay1
https://studionol.co.kr/ko/stories/vocalrange1
https://studionol.co.kr/ko/stories/plugins1
```

> 근거: GSC·네이버 양쪽에서 노출/클릭 상위. "노래 녹음 스튜디오·음원 유통사 비교·보컬 리버브·스포티파이 음원 수익" 등 네이버 키워드와 매칭.

---

## 📌 제출 후 할 일

1. **RSS 등록** (1회): 요청 → RSS 제출 → `https://studionol.co.kr/api/rss?locale=ko`
2. **2주 후 재확인**: 사이트 진단 → 색인 페이지 수가 390 → 얼마나 늘었는지 체크
3. 색인 늘면 티어 외 나머지 스토리는 사이트맵·RSS로 자연 수집되므로 수동 제출 불필요

## 참고 — 하지 말 것
- 1,571개 전부 수동 제출 ❌ (할당량 낭비 + 불필요). 핵심 47개만 밀고 나머지는 사이트맵·RSS에 맡김.
- 색인 안 된다고 같은 URL 하루에 여러 번 반복 제출 ❌
