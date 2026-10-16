CREATE TABLE `partner_payout_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`payee_key` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`source_ref` text,
	`memo` text,
	`origin_payout_id` text,
	`applied_payout_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "partner_payout_adjustments_kind_check" CHECK("partner_payout_adjustments"."kind" in ('shop','show')),
	CONSTRAINT "partner_payout_adjustments_reason_check" CHECK("partner_payout_adjustments"."reason" in ('late_refund','showtime_cancel_fee','manual'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partner_payout_adjustments_source_unique` ON `partner_payout_adjustments` (`kind`,`payee_key`,`reason`,`source_ref`);--> statement-breakpoint
CREATE INDEX `partner_payout_adjustments_payee_idx` ON `partner_payout_adjustments` (`kind`,`payee_key`,`applied_payout_id`);--> statement-breakpoint
CREATE INDEX `partner_payout_adjustments_applied_idx` ON `partner_payout_adjustments` (`applied_payout_id`);--> statement-breakpoint
CREATE INDEX `partner_payout_adjustments_origin_idx` ON `partner_payout_adjustments` (`origin_payout_id`);--> statement-breakpoint
CREATE TABLE `partner_payouts` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`subject_key` text NOT NULL,
	`period` text NOT NULL,
	`creator_id` text,
	`payee_name` text NOT NULL,
	`tax_type` text NOT NULL,
	`gross_amount` integer DEFAULT 0 NOT NULL,
	`refund_amount` integer DEFAULT 0 NOT NULL,
	`shipping_amount` integer DEFAULT 0 NOT NULL,
	`platform_fee_amount` integer DEFAULT 0 NOT NULL,
	`payment_fee_amount` integer DEFAULT 0 NOT NULL,
	`studio_amount` integer DEFAULT 0 NOT NULL,
	`vat_deduction_amount` integer DEFAULT 0 NOT NULL,
	`share_amount` integer DEFAULT 0 NOT NULL,
	`withholding_amount` integer DEFAULT 0 NOT NULL,
	`adjustment_amount` integer DEFAULT 0 NOT NULL,
	`shortfall_amount` integer DEFAULT 0 NOT NULL,
	`net_amount` integer NOT NULL,
	`item_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`paid_at` integer,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `funding_creators`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "partner_payouts_kind_check" CHECK("partner_payouts"."kind" in ('shop','show')),
	CONSTRAINT "partner_payouts_status_check" CHECK("partner_payouts"."status" in ('pending','paid'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partner_payouts_subject_unique` ON `partner_payouts` (`kind`,`subject_key`,`period`);--> statement-breakpoint
CREATE INDEX `partner_payouts_status_idx` ON `partner_payouts` (`kind`,`status`);--> statement-breakpoint
CREATE INDEX `partner_payouts_creator_idx` ON `partner_payouts` (`creator_id`);