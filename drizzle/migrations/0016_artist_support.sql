CREATE TABLE `artist_payouts` (
	`id` text PRIMARY KEY NOT NULL,
	`artist_slug` text NOT NULL,
	`period` text NOT NULL,
	`gross_amount` integer NOT NULL,
	`refund_amount` integer NOT NULL,
	`supply_amount` integer NOT NULL,
	`share_amount` integer NOT NULL,
	`withholding_amount` integer NOT NULL,
	`net_amount` integer NOT NULL,
	`subscriber_count` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`paid_at` integer,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `artist_payouts_artist_period_unique` ON `artist_payouts` (`artist_slug`,`period`);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `artist_slug` text;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `tier_id` text;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `display_name` text;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `display_consent` integer DEFAULT false NOT NULL;