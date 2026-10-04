CREATE TABLE `refund_accounts` (
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
	CONSTRAINT "refund_accounts_order_kind_check" CHECK("refund_accounts"."order_kind" in ('funding', 'session', 'mixing', 'show'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `refund_accounts_order_uq` ON `refund_accounts` (`order_kind`,`order_no`);