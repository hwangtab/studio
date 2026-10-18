PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_refund_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`order_kind` text NOT NULL,
	`order_no` text NOT NULL,
	`bank_name` text NOT NULL,
	`account_number_enc` text NOT NULL,
	`account_holder` text NOT NULL,
	`requested_at` integer NOT NULL,
	`refunded_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "refund_accounts_order_kind_check" CHECK("__new_refund_accounts"."order_kind" in ('funding', 'session', 'mixing', 'show', 'merch', 'production'))
);
--> statement-breakpoint
INSERT INTO `__new_refund_accounts`("id", "order_kind", "order_no", "bank_name", "account_number_enc", "account_holder", "requested_at", "refunded_at", "created_at", "updated_at") SELECT "id", "order_kind", "order_no", "bank_name", "account_number_enc", "account_holder", "requested_at", "refunded_at", "created_at", "updated_at" FROM `refund_accounts`;--> statement-breakpoint
DROP TABLE `refund_accounts`;--> statement-breakpoint
ALTER TABLE `__new_refund_accounts` RENAME TO `refund_accounts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `refund_accounts_order_uq` ON `refund_accounts` (`order_kind`,`order_no`);--> statement-breakpoint
ALTER TABLE `production_contract_signers` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `production_contract_signers` ADD `relation` text;