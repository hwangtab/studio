ALTER TABLE `funding_creators` ADD `payout_account_enc` text;--> statement-breakpoint
ALTER TABLE `funding_creators` ADD `payout_account_last4` text;--> statement-breakpoint
-- 평문 계좌 컬럼을 비운다. 운영 DB의 funding_creators는 0행이라 지워질 값이 없고,
-- 값이 남아 있는 개발·테스트 DB에서는 평문이 남아 있는 것 자체가 이 변경이 없애려는
-- 상태다. 새 값은 개설자가 정산 구획에서 다시 입력하면 암호문으로 들어간다
-- (암호화 키가 이 SQL에는 없으므로 여기서 옮겨 담을 수는 없다).
-- 컬럼 자체는 이번에 지우지 않는다 — 이 저장소는 마이그레이션을 먼저 적용하고 코드를
-- 나중에 배포하므로, 지우면 그 사이에 도는 옛 코드가 없는 컬럼을 읽고 깨진다.
UPDATE `funding_creators` SET `payout_bank_name` = NULL, `payout_account` = NULL, `payout_holder` = NULL;
