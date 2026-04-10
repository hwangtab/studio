# Stories 콘텐츠 품질 블라인드 스팟 감사 리포트 (2026-04-10)

## 전체 요약
- 대상 파일: `1135`개
- 기준 문서: [`docs/content-guidelines.md`](/Users/hwang-gyeongha/studio/docs/content-guidelines.md)
- 현행 검증 스크립트는 파싱 오류와 일부 금지 패턴만 막고 있어, 톤·CTA·템플릿 반복은 별도 감사가 필요합니다.

## 버킷별 정량 결과
- `Tone Drift`: `112`개 파일
- `CTA Drift`: `380`개 파일
- `Template Fatigue`: `926`개 파일
- `Guideline Mismatch`: `966`개 파일
- `Manual Review Queue`: `18`개 파일

### 우선순위 분포
- `Auto-fix candidate`: `921`개 파일
- `Manual rewrite candidate`: `38`개 파일
- `Rule-only ignore`: `176`개 파일

### Tone Drift 예시
- [logicpro1.md](/Users/hwang-gyeongha/studio/content/stories/logicpro1.md) `녹음 가이드` `Auto-fix candidate`: 과장/전환 톤 3건
- [jinhae1.md](/Users/hwang-gyeongha/studio/content/stories/jinhae1.md) `지역 가이드` `Manual rewrite candidate`: 과장/전환 톤 2건
- [review6.md](/Users/hwang-gyeongha/studio/content/stories/review6.md) `후기` `Manual rewrite candidate`: 과장/전환 톤 2건
- [daw-choice1.md](/Users/hwang-gyeongha/studio/content/stories/daw-choice1.md) `음악 제작 가이드` `Manual rewrite candidate`: 과장/전환 톤 1건; 홍보성 '완벽' 문장 1건
- [voice1.md](/Users/hwang-gyeongha/studio/content/stories/voice1.md) `후기` `Manual rewrite candidate`: 과장/전환 톤 1건; 홍보성 '완벽' 문장 1건

### CTA Drift 예시
- [booking1.md](/Users/hwang-gyeongha/studio/content/stories/booking1.md) `강좌` `Auto-fix candidate`: 서비스 링크 1개; 카카오톡 문의 6회; 직접 행동 유도 7건
- [cover1.md](/Users/hwang-gyeongha/studio/content/stories/cover1.md) `강좌` `Manual rewrite candidate`: 서비스 링크 1개; 카카오톡 문의 2회; 직접 행동 유도 4건
- [lesson1.md](/Users/hwang-gyeongha/studio/content/stories/lesson1.md) `강좌` `Auto-fix candidate`: 카카오톡 문의 2회; 직접 행동 유도 2건
- [pricing1.md](/Users/hwang-gyeongha/studio/content/stories/pricing1.md) `강좌` `Auto-fix candidate`: 서비스 링크 1개; 직접 행동 유도 2건
- [mixing13.md](/Users/hwang-gyeongha/studio/content/stories/mixing13.md) `강좌` `Auto-fix candidate`: 서비스 링크 1개; 직접 행동 유도 2건

### Template Fatigue 예시
- [uijeongbu1.md](/Users/hwang-gyeongha/studio/content/stories/uijeongbu1.md) `가이드` `Auto-fix candidate`: `## 마치며` 사용; 반복 heading 3개; 반복 본문/CTA 문장 4개
- [yangjae1.md](/Users/hwang-gyeongha/studio/content/stories/yangjae1.md) `지역 가이드` `Auto-fix candidate`: `## 마치며` 사용; summary '가이드입니다'; 반복 heading 2개
- [wirye1.md](/Users/hwang-gyeongha/studio/content/stories/wirye1.md) `지역 가이드` `Auto-fix candidate`: `## 마치며` 사용; summary '가이드입니다'; 반복 heading 2개
- [suwon1.md](/Users/hwang-gyeongha/studio/content/stories/suwon1.md) `가이드` `Auto-fix candidate`: `## 마치며` 사용; 반복 heading 3개; 반복 본문/CTA 문장 3개
- [seongnam1.md](/Users/hwang-gyeongha/studio/content/stories/seongnam1.md) `가이드` `Auto-fix candidate`: `## 마치며` 사용; 반복 heading 3개; 반복 본문/CTA 문장 3개

### Guideline Mismatch 예시
- [cover1.md](/Users/hwang-gyeongha/studio/content/stories/cover1.md) `강좌` `Manual rewrite candidate`: 형식적 종결 4건; summary 매뉴얼 톤
- [lesson1.md](/Users/hwang-gyeongha/studio/content/stories/lesson1.md) `강좌` `Auto-fix candidate`: 형식적 종결 12건; summary 매뉴얼 톤
- [gwanak1.md](/Users/hwang-gyeongha/studio/content/stories/gwanak1.md) `지역 가이드` `Manual rewrite candidate`: 형식적 종결 9건; summary 매뉴얼 톤
- [seongbuk1.md](/Users/hwang-gyeongha/studio/content/stories/seongbuk1.md) `가이드` `Auto-fix candidate`: 형식적 종결 4건; summary 매뉴얼 톤
- [pricing1.md](/Users/hwang-gyeongha/studio/content/stories/pricing1.md) `강좌` `Auto-fix candidate`: 형식적 종결 5건; summary 매뉴얼 톤

## 카테고리별 분포
- `지역 가이드`: files `371`, Tone `14`, CTA `175`, Template `371`, Guideline `370`
- `강좌`: files `179`, Tone `28`, CTA `65`, Template `155`, Guideline `179`
- `lesson`: files `138`, Tone `0`, CTA `0`, Template `0`, Guideline `0`
- `음반 제작 가이드`: files `127`, Tone `15`, CTA `29`, Template `127`, Guideline `127`
- `녹음 가이드`: files `51`, Tone `8`, CTA `15`, Template `51`, Guideline `51`
- `가이드`: files `46`, Tone `5`, CTA `29`, Template `46`, Guideline `46`
- `보컬 가이드`: files `43`, Tone `13`, CTA `6`, Template `43`, Guideline `43`
- `악기 연습`: files `31`, Tone `2`, CTA `31`, Template `31`, Guideline `31`
- `event`: files `18`, Tone `0`, CTA `0`, Template `0`, Guideline `0`
- `후기`: files `17`, Tone `8`, CTA `4`, Template `7`, Guideline `17`
- `믹싱 가이드`: files `16`, Tone `2`, CTA `1`, Template `16`, Guideline `16`
- `음악 비즈니스 가이드`: files `14`, Tone `0`, CTA `7`, Template `14`, Guideline `14`
- `음악 프로덕션 가이드`: files `13`, Tone `1`, CTA `4`, Template `13`, Guideline `13`
- `발성 가이드`: files `7`, Tone `3`, CTA `0`, Template `7`, Guideline `7`
- `interview`: files `6`, Tone `0`, CTA `0`, Template `0`, Guideline `0`

## 구조적 반복 신호
### 반복 heading
- `## 마치며`: `872`개 파일
- `## 관련 링크`: `54`개 파일
- `## 지역별 이동 경로`: `47`개 파일
- `## 스튜디오 놀 서비스`: `45`개 파일
- `## 온라인 의뢰 서비스`: `36`개 파일
- `## 각 지역에서 스튜디오 놀까지`: `24`개 파일
- `## 짧은 체크리스트`: `23`개 파일
- `## 이 페이지가 필요한 사람`: `23`개 파일
- `## 연신내/타 권역과 비교할 때 판단 기준`: `22`개 파일
- `## 해당 권역의 연습실 특징`: `22`개 파일

### 반복 마무리 문장
- `기초를 탄탄히 해두면 어떤 장르에도 응용할 수 있습니다.`: `13`개 파일
- `믹스에서 가장 중요한 건 전체 밸런스를 잃지 않는 것입니다.`: `2`개 파일
- `방문이 부담스럽다면 카카오톡으로 온라인 의뢰도 가능합니다.`: `2`개 파일
- `808 베이스는 튜닝과 사이드체인이 핵심입니다.`: `1`개 파일
- `Ableton Live는 루프 기반 창작과 전통 보컬 녹음을 하나의 환경에서 처리할 수 있는 강력한 DAW입니다.`: `1`개 파일
- `아카펠라는 목소리 앙상블의 정수입니다.`: `1`개 파일
- `어쿠스틱 기타 녹음은 공간과 마이크 선택이 핵심입니다.`: `1`개 파일
- `완벽한 방음이 없어도 흡음 처리만으로 사용 가능한 드라이 보컬을 녹음할 수 있습니다.`: `1`개 파일
- `어쿠스틱 악기 녹음은 방음·흡음 환경과 마이킹 경험이 결합될 때 최상의 결과물이 나옵니다.`: `1`개 파일
- `애드립·런은 기술이 아닌 감정 표현의 도구입니다.`: `1`개 파일

### 반복 본문/CTA 문장
- `170`개: 온라인 파일 의뢰도 가능합니다. 현지에서 드라이 보컬 WAV를 녹음해 파일로 보내주시면 믹싱·마스터링 후 납품합니다.
- `77`개: 3. 서울역 → 지하철 → 연신내역 (약 30~40분)
- `59`개: - 오후 12시 30분 세션 완료
- `55`개: - 오전 10시 30분 세션 시작 (2시간)
- `49`개: **스튜디오 주소**: 서울특별시 은평구 연신내역 인근 (연신내역 3번 출구 도보 5분)
- `48`개: 입구 위치나 주차 정보가 필요한 경우 예약 전 문의해주시면 안내드립니다.
- `46`개: 주차 공간은 제한적이므로 대중교통 이용을 권장합니다.
- `42`개: 스튜디오 방문 전 예약을 완료하면 불필요한 대기 없이 바로 이용할 수 있습니다.
- `41`개: 처음 방문하는 분은 예약 시간 10분 전에 도착하면 여유롭게 시작할 수 있습니다.
- `38`개: 바이패스로 전후 비교하는 습관이 과처리를 막는 가장 효과적인 방법입니다.

## 분류별 후속 조치
### Auto-fix candidate
- [808-bass1.md](/Users/hwang-gyeongha/studio/content/stories/808-bass1.md) `음반 제작 가이드`: summary가 '가이드입니다'로 끝남; 가이드라인 금지 문체가 멘토 톤 없이 반복됨
- [ableton1.md](/Users/hwang-gyeongha/studio/content/stories/ableton1.md) `녹음 가이드`: summary가 '가이드입니다'로 끝남; 가이드라인 금지 문체가 멘토 톤 없이 반복됨
- [acapella1.md](/Users/hwang-gyeongha/studio/content/stories/acapella1.md) `강좌`: 가이드라인 금지 문체가 멘토 톤 없이 반복됨; 마무리 heading 템플릿 사용
- [acoustic-recording1.md](/Users/hwang-gyeongha/studio/content/stories/acoustic-recording1.md) `음반 제작 가이드`: summary가 '가이드입니다'로 끝남; 가이드라인 금지 문체가 멘토 톤 없이 반복됨
- [acoustic1.md](/Users/hwang-gyeongha/studio/content/stories/acoustic1.md) `강좌`: 지식형 글에 직접 행동 유도 문구가 남아 있음
- [adlib1.md](/Users/hwang-gyeongha/studio/content/stories/adlib1.md) `보컬 가이드`: 지식형 글에 직접 행동 유도 문구가 남아 있음
- [advertisement-music1.md](/Users/hwang-gyeongha/studio/content/stories/advertisement-music1.md) `음악 프로덕션 가이드`: summary가 '가이드입니다'로 끝남; 가이드라인 금지 문체가 멘토 톤 없이 반복됨
- [ai-mastering1.md](/Users/hwang-gyeongha/studio/content/stories/ai-mastering1.md) `음반 제작 가이드`: summary가 '가이드입니다'로 끝남; 가이드라인 금지 문체가 멘토 톤 없이 반복됨
- [ai-music1.md](/Users/hwang-gyeongha/studio/content/stories/ai-music1.md) `음악 프로덕션 가이드`: 지식형 글에 직접 행동 유도 문구가 남아 있음
- [album-art1.md](/Users/hwang-gyeongha/studio/content/stories/album-art1.md) `음반 제작 가이드`: 지식형 글에 직접 행동 유도 문구가 남아 있음
### Rule-only ignore
- [bulgwang-mixing-club-2nd.en.md](/Users/hwang-gyeongha/studio/content/stories/bulgwang-mixing-club-2nd.en.md) `event`: 세부 사유 없음
- [bulgwang-mixing-club-2nd.es.md](/Users/hwang-gyeongha/studio/content/stories/bulgwang-mixing-club-2nd.es.md) `event`: 세부 사유 없음
- [bulgwang-mixing-club-2nd.th.md](/Users/hwang-gyeongha/studio/content/stories/bulgwang-mixing-club-2nd.th.md) `event`: 세부 사유 없음
- [bulgwang-mixing-club-2nd.uz.md](/Users/hwang-gyeongha/studio/content/stories/bulgwang-mixing-club-2nd.uz.md) `event`: 세부 사유 없음
- [bulgwang-mixing-club-2nd.vi.md](/Users/hwang-gyeongha/studio/content/stories/bulgwang-mixing-club-2nd.vi.md) `event`: 세부 사유 없음
- [bulgwang-mixing-club-2nd.zh.md](/Users/hwang-gyeongha/studio/content/stories/bulgwang-mixing-club-2nd.zh.md) `event`: 세부 사유 없음
- [bulgwang-mixing-club-3rd.en.md](/Users/hwang-gyeongha/studio/content/stories/bulgwang-mixing-club-3rd.en.md) `event`: 세부 사유 없음
- [bulgwang-mixing-club-3rd.es.md](/Users/hwang-gyeongha/studio/content/stories/bulgwang-mixing-club-3rd.es.md) `event`: 세부 사유 없음
- [bulgwang-mixing-club-3rd.md](/Users/hwang-gyeongha/studio/content/stories/bulgwang-mixing-club-3rd.md) `이벤트`: 형식적 문장 종결이 일부 남아 있음
- [bulgwang-mixing-club-3rd.th.md](/Users/hwang-gyeongha/studio/content/stories/bulgwang-mixing-club-3rd.th.md) `event`: 세부 사유 없음
### Manual rewrite candidate
- [acoustic-treatment1.md](/Users/hwang-gyeongha/studio/content/stories/acoustic-treatment1.md) `강좌`: 홍보성 '완벽' 문장 1건
- [asmr1.md](/Users/hwang-gyeongha/studio/content/stories/asmr1.md) `가이드`: 홍보성 '완벽' 문장 1건
- [audition1.md](/Users/hwang-gyeongha/studio/content/stories/audition1.md) `강좌`: 지식형 글에 직접 행동 유도 문구가 남아 있음; 홍보성 '완벽' 문장 1건
- [collab-tools1.md](/Users/hwang-gyeongha/studio/content/stories/collab-tools1.md) `음악 제작`: 홍보성 '완벽' 문장 1건
- [comping1.md](/Users/hwang-gyeongha/studio/content/stories/comping1.md) `음반 제작 가이드`: 홍보성 '완벽' 문장 1건
- [cover1.md](/Users/hwang-gyeongha/studio/content/stories/cover1.md) `강좌`: 지식형 글에 직접 행동 유도 문구가 남아 있음; 홍보성 '완벽' 문장 1건
- [daw-choice1.md](/Users/hwang-gyeongha/studio/content/stories/daw-choice1.md) `음악 제작 가이드`: 과장/전환 톤 1건; 홍보성 '완벽' 문장 1건
- [dongjak-heukseok1.md](/Users/hwang-gyeongha/studio/content/stories/dongjak-heukseok1.md) `지역 가이드`: 과장/전환 톤 1건; 지역 가이드에 직접 전환 문구가 남아 있음
- [dongjak1.md](/Users/hwang-gyeongha/studio/content/stories/dongjak1.md) `지역 가이드`: 과장/전환 톤 1건; 지역 가이드에 직접 전환 문구가 남아 있음
- [ep-album1.md](/Users/hwang-gyeongha/studio/content/stories/ep-album1.md) `음반 제작 가이드`: 과장/전환 톤 1건; 지식형 글에 직접 행동 유도 문구가 남아 있음

## 수동 리뷰 표본 (18개)
### 지역/서비스형 6개
- [gwanak1.md](/Users/hwang-gyeongha/studio/content/stories/gwanak1.md) `지역 가이드` (tone `rewrite`, density `watch`, cta `rewrite`, template `rewrite`, naturalness `watch`) - 지역 이동 정보는 남아 있지만 가격표·예약 유도·홍보형 추천 이유가 많아 정보형 가이드보다 랜딩 페이지 톤이 강합니다.
- [dongjak1.md](/Users/hwang-gyeongha/studio/content/stories/dongjak1.md) `지역 가이드` (tone `rewrite`, density `watch`, cta `rewrite`, template `rewrite`, naturalness `watch`) - 생활권 안내는 유효하지만 서비스 소개, 예약 방법, 가격표가 본문 절반 가까이를 차지해 지역 가이드의 정보 밀도가 흐려집니다.
- [jinhae1.md](/Users/hwang-gyeongha/studio/content/stories/jinhae1.md) `지역 가이드` (tone `rewrite`, density `watch`, cta `rewrite`, template `rewrite`, naturalness `rewrite`) - 장거리 방문 정보는 useful하지만 summary의 '가이드을' 오타와 무료 견적·품질 보장형 문구가 함께 남아 있어 완성도가 낮습니다.
- [yangjae1.md](/Users/hwang-gyeongha/studio/content/stories/yangjae1.md) `지역 가이드` (tone `watch`, density `watch`, cta `rewrite`, template `rewrite`, naturalness `rewrite`) - 정보 자체는 평범하지만 heading 중복과 닫는 문장 압축이 어색하고, pricing 링크까지 붙어 있어 최근 자동 정리 자국이 보입니다.
- [wirye1.md](/Users/hwang-gyeongha/studio/content/stories/wirye1.md) `지역 가이드` (tone `watch`, density `watch`, cta `watch`, template `rewrite`, naturalness `rewrite`) - 이동 정보는 살아 있지만 본문 중간의 삽입형 일반론과 중복 heading 때문에 지역 안내 흐름이 자주 끊깁니다.
- [seongdong1.md](/Users/hwang-gyeongha/studio/content/stories/seongdong1.md) `지역 가이드` (tone `watch`, density `watch`, cta `rewrite`, template `rewrite`, naturalness `rewrite`) - 당일 세션·예약 유도는 강하고, 본문에 들어간 일반론 문장과 마무리 압축 문장이 자연스럽지 않아 최근 정리 자국이 남습니다.
### 기술/강좌형 6개
- [booking1.md](/Users/hwang-gyeongha/studio/content/stories/booking1.md) `강좌` (tone `watch`, density `good`, cta `rewrite`, template `watch`, naturalness `watch`) - 절차 설명은 명확하지만 지식형 글 기준으로는 카카오톡 문의와 견적 유도가 여전히 강하고, 결론부도 서비스 안내에 가깝습니다.
- [cover1.md](/Users/hwang-gyeongha/studio/content/stories/cover1.md) `강좌` (tone `rewrite`, density `good`, cta `rewrite`, template `watch`, naturalness `watch`) - 커버곡 녹음 실무 정보는 충분하지만 비용·문의 문구가 반복돼 정보형 강좌보다 서비스 세일즈 문서처럼 읽힙니다.
- [lesson1.md](/Users/hwang-gyeongha/studio/content/stories/lesson1.md) `강좌` (tone `rewrite`, density `watch`, cta `rewrite`, template `watch`, naturalness `watch`) - 보컬 레슨 소개라는 의도는 명확하지만 글 전반이 서비스 안내문 톤이라 ‘강좌’ 카테고리 기대치와 어긋납니다.
- [logicpro1.md](/Users/hwang-gyeongha/studio/content/stories/logicpro1.md) `녹음 가이드` (tone `watch`, density `good`, cta `good`, template `watch`, naturalness `watch`) - 기술 정보 밀도는 높지만 '프로급' 같은 과장형 제목과 반복적인 boilerplate lead-in 문장이 멘토 톤을 약하게 만듭니다.
- [seongbuk1.md](/Users/hwang-gyeongha/studio/content/stories/seongbuk1.md) `가이드` (tone `rewrite`, density `watch`, cta `rewrite`, template `rewrite`, naturalness `rewrite`) - 지역형 랜딩 구조와 가이드 카테고리가 뒤섞여 있고 중복 구분선, 직접 문의 문구 등 편집 완성도 문제도 남아 있습니다.
- [pricing1.md](/Users/hwang-gyeongha/studio/content/stories/pricing1.md) `강좌` (tone `watch`, density `good`, cta `watch`, template `watch`, naturalness `good`) - 가격 가이드라는 검색 의도에는 맞지만 축가 패키지 홍보 문구와 직접 pricing 링크가 중립성을 조금 약하게 만듭니다.
### 최근 정리본 6개
- [practice-room-yeonsinnae1.md](/Users/hwang-gyeongha/studio/content/stories/practice-room-yeonsinnae1.md) `지역 가이드` (tone `good`, density `good`, cta `watch`, template `good`, naturalness `good`) - 최근 축약 허브 중에서는 가장 안정적입니다. 다만 관련 링크에 서비스 페이지와 가격 링크가 함께 있어 soft CTA 경계는 남아 있습니다.
- [practice-room-recording1.md](/Users/hwang-gyeongha/studio/content/stories/practice-room-recording1.md) `악기 연습` (tone `good`, density `good`, cta `watch`, template `good`, naturalness `watch`) - 톤과 정보 구조는 안정적이지만 related link가 `/stories/ko/...` 형태라 링크 정합성 블라인드 스팟이 드러납니다.
- [practice-room-private1.md](/Users/hwang-gyeongha/studio/content/stories/practice-room-private1.md) `악기 연습` (tone `good`, density `good`, cta `watch`, template `good`, naturalness `watch`) - 최근 정리본답게 과한 SEO 문구는 거의 없지만, 마지막 추천 문장과 locale형 story link는 아직 자동 검증 밖에 있습니다.
- [practice-room-guide1.md](/Users/hwang-gyeongha/studio/content/stories/practice-room-guide1.md) `악기 연습` (tone `good`, density `good`, cta `watch`, template `good`, naturalness `good`) - 비교 기준이 명확하고 사람 읽기형 구조가 잘 유지됩니다. 남은 이슈는 soft CTA 수준의 관련 링크 관리 정도입니다.
- [practice-room-first1.md](/Users/hwang-gyeongha/studio/content/stories/practice-room-first1.md) `악기 연습` (tone `good`, density `good`, cta `watch`, template `good`, naturalness `good`) - 입문자용 흐름이 매끄럽고 과장 톤도 적습니다. 다만 다른 최근 정리본과 같은 locale형 내부 링크 패턴은 점검이 필요합니다.
- [practice-room-booking1.md](/Users/hwang-gyeongha/studio/content/stories/practice-room-booking1.md) `악기 연습` (tone `good`, density `good`, cta `watch`, template `good`, naturalness `good`) - 예약 글답게 행동 정보가 분명하고 판매 압력은 낮은 편입니다. related link와 서비스 링크의 soft CTA 경계만 관리하면 됩니다.

## 우선순위 상위 20개 파일
- [booking1.md](/Users/hwang-gyeongha/studio/content/stories/booking1.md) `강좌` `Auto-fix candidate` (score `41`): 지식형 글에 직접 행동 유도 문구가 남아 있음
- [cover1.md](/Users/hwang-gyeongha/studio/content/stories/cover1.md) `강좌` `Manual rewrite candidate` (score `27`): 지식형 글에 직접 행동 유도 문구가 남아 있음; 홍보성 '완벽' 문장 1건
- [lesson1.md](/Users/hwang-gyeongha/studio/content/stories/lesson1.md) `강좌` `Auto-fix candidate` (score `17`): 지식형 글에 직접 행동 유도 문구가 남아 있음
- [logicpro1.md](/Users/hwang-gyeongha/studio/content/stories/logicpro1.md) `녹음 가이드` `Auto-fix candidate` (score `16`): 과장/전환 톤 3건
- [gwanak1.md](/Users/hwang-gyeongha/studio/content/stories/gwanak1.md) `지역 가이드` `Manual rewrite candidate` (score `16`): 과장/전환 톤 1건; 지역 가이드에 직접 전환 문구가 남아 있음
- [seongbuk1.md](/Users/hwang-gyeongha/studio/content/stories/seongbuk1.md) `가이드` `Auto-fix candidate` (score `15`): 지식형 글에 직접 행동 유도 문구가 남아 있음
- [pricing1.md](/Users/hwang-gyeongha/studio/content/stories/pricing1.md) `강좌` `Auto-fix candidate` (score `15`): 지식형 글에 직접 행동 유도 문구가 남아 있음
- [nowon1.md](/Users/hwang-gyeongha/studio/content/stories/nowon1.md) `가이드` `Auto-fix candidate` (score `15`): 지식형 글에 직접 행동 유도 문구가 남아 있음
- [indie-showcase1.md](/Users/hwang-gyeongha/studio/content/stories/indie-showcase1.md) `음악 비즈니스` `Auto-fix candidate` (score `15`): 지식형 글에 직접 행동 유도 문구가 남아 있음
- [ep-album1.md](/Users/hwang-gyeongha/studio/content/stories/ep-album1.md) `음반 제작 가이드` `Manual rewrite candidate` (score `15`): 과장/전환 톤 1건; 지식형 글에 직접 행동 유도 문구가 남아 있음
- [dongjak1.md](/Users/hwang-gyeongha/studio/content/stories/dongjak1.md) `지역 가이드` `Manual rewrite candidate` (score `15`): 과장/전환 톤 1건; 지역 가이드에 직접 전환 문구가 남아 있음
- [album-artwork1.md](/Users/hwang-gyeongha/studio/content/stories/album-artwork1.md) `음악 비즈니스 가이드` `Auto-fix candidate` (score `15`): 지식형 글에 직접 행동 유도 문구가 남아 있음
- [album-art1.md](/Users/hwang-gyeongha/studio/content/stories/album-art1.md) `음반 제작 가이드` `Auto-fix candidate` (score `15`): 지식형 글에 직접 행동 유도 문구가 남아 있음
- [uijeongbu1.md](/Users/hwang-gyeongha/studio/content/stories/uijeongbu1.md) `가이드` `Auto-fix candidate` (score `14`): '즉시' 표현 1건; summary가 매뉴얼 톤으로 닫힘; 가이드라인 금지 문체가 멘토 톤 없이 반복됨
- [mixing13.md](/Users/hwang-gyeongha/studio/content/stories/mixing13.md) `강좌` `Auto-fix candidate` (score `14`): 지식형 글에 직접 행동 유도 문구가 남아 있음
- [jinhae1.md](/Users/hwang-gyeongha/studio/content/stories/jinhae1.md) `지역 가이드` `Manual rewrite candidate` (score `14`): 과장/전환 톤 2건; 지역 가이드에 직접 전환 문구가 남아 있음
- [yangjae1.md](/Users/hwang-gyeongha/studio/content/stories/yangjae1.md) `지역 가이드` `Auto-fix candidate` (score `13`): soft CTA 허용치를 넘는 서비스 유도 4회; summary가 '가이드입니다'로 끝남; 가이드라인 금지 문체가 멘토 톤 없이 반복됨
- [wirye1.md](/Users/hwang-gyeongha/studio/content/stories/wirye1.md) `지역 가이드` `Auto-fix candidate` (score `13`): soft CTA 허용치를 넘는 서비스 유도 4회; summary가 '가이드입니다'로 끝남; 가이드라인 금지 문체가 멘토 톤 없이 반복됨
- [suwon1.md](/Users/hwang-gyeongha/studio/content/stories/suwon1.md) `가이드` `Auto-fix candidate` (score `13`): summary가 매뉴얼 톤으로 닫힘; 가이드라인 금지 문체가 멘토 톤 없이 반복됨; 마무리 heading 템플릿 사용
- [seongnam1.md](/Users/hwang-gyeongha/studio/content/stories/seongnam1.md) `가이드` `Auto-fix candidate` (score `13`): summary가 매뉴얼 톤으로 닫힘; 가이드라인 금지 문체가 멘토 톤 없이 반복됨; 마무리 heading 템플릿 사용

## 다음 단계 제안
- `validate_story_quality.py`를 이 리포트의 기계적 패턴 일부까지 확장해 검증 범위를 넓힙니다.
- `지역 가이드`와 `지식형 글`을 분리한 CTA 규칙을 추가해 카테고리별 기준을 강제합니다.
- `Manual rewrite candidate` 상위 파일부터 사람 손 재작성 배치를 따로 진행합니다.

