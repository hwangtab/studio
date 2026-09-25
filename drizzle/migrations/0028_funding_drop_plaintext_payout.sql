-- 평문 정산 계좌 컬럼 세 개를 지운다. 값은 0027이 이미 NULL로 비웠고, 정본은
-- `payout_account_enc`(암호문 한 벌) + `payout_account_last4`(표시용)이다.
--
-- ⚠ **적용 순서가 이 저장소의 평소와 반대다 — 코드 배포가 먼저, 이 마이그레이션이 나중.**
-- 컬럼 추가는 옛 코드에 무해하므로 평소에는 마이그레이션을 먼저 적용한다. DROP은 정반대다:
-- 아직 도는 옛 코드가 `select()`로 이 컬럼들을 나열하면 `no such column`으로 개설자 화면과
-- 정산 미리보기가 통째로 깨진다. 반대로 스키마에서 지운 코드가 먼저 떠 있고 DB에 컬럼이
-- 남아 있는 상태는 무해하다 — 아무도 읽지 않는다. 그러니 이 파일은 **배포가 끝난 뒤에만**
-- 적용한다.
--
-- SQLite의 `ALTER TABLE ... DROP COLUMN`(3.35+)은 인덱스·UNIQUE·기본키·외래키·CHECK·뷰·
-- 트리거에 걸린 컬럼을 거부한다. 이 셋은 어디에도 걸려 있지 않다 — `funding_creators`의
-- 인덱스는 `funding_creators_email_unique` 하나뿐이고, 이 저장소의 마이그레이션에 뷰·
-- 트리거는 없다. 그래서 drizzle이 테이블 재작성 없이 단순 ALTER 세 줄로 발행했고,
-- 데이터를 옮겨 담는 과정이 없으므로 다른 컬럼의 값·기본값·인덱스는 그대로 남는다.
ALTER TABLE `funding_creators` DROP COLUMN `payout_bank_name`;--> statement-breakpoint
ALTER TABLE `funding_creators` DROP COLUMN `payout_account`;--> statement-breakpoint
ALTER TABLE `funding_creators` DROP COLUMN `payout_holder`;
