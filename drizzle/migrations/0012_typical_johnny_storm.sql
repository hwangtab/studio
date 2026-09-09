CREATE TABLE `billing_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`billing_key` text NOT NULL,
	`card_company` text,
	`card_number_masked` text,
	`card_type` text,
	`issued_at` integer DEFAULT (unixepoch()) NOT NULL,
	`revoked_at` integer,
	`raw_response` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_keys_billing_key_unique` ON `billing_keys` (`billing_key`);--> statement-breakpoint
CREATE TABLE `subscription_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`order_id` text NOT NULL,
	`cycle_ym` text NOT NULL,
	`attempt` integer NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`toss_code` text,
	`toss_message` text,
	`payment_key` text,
	`attempted_at` integer DEFAULT (unixepoch()) NOT NULL,
	`paid_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscription_payments_cycle_attempt_unique` ON `subscription_payments` (`subscription_id`,`cycle_ym`,`attempt`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`contract_id` text,
	`customer_name` text NOT NULL,
	`customer_phone` text NOT NULL,
	`customer_email` text NOT NULL,
	`customer_key` text NOT NULL,
	`item_amount` integer NOT NULL,
	`vat_amount` integer NOT NULL,
	`total_amount` integer NOT NULL,
	`billing_day` integer NOT NULL,
	`status` text DEFAULT 'pending_card' NOT NULL,
	`billing_key_id` text,
	`next_billing_at` integer,
	`current_period_start` integer,
	`current_period_end` integer,
	`setup_token` text,
	`setup_token_expires_at` integer,
	`setup_mode` text DEFAULT 'initial' NOT NULL,
	`manage_token` text NOT NULL,
	`cancelled_at` integer,
	`cancel_reason` text,
	`ends_at` integer,
	`notification_error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_customer_key_unique` ON `subscriptions` (`customer_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_setup_token_unique` ON `subscriptions` (`setup_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `subscriptions_manage_token_unique` ON `subscriptions` (`manage_token`);