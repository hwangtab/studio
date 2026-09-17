CREATE TABLE `funding_creator_tokens` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`creator_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `funding_creators`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `funding_creators` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`contact_name` text,
	`phone` text,
	`tax_type` text,
	`payout_bank_name` text,
	`payout_account` text,
	`payout_holder` text,
	`last_login_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `funding_creators_email_unique` ON `funding_creators` (`email`);--> statement-breakpoint
CREATE TABLE `funding_project_payouts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`gross_amount` integer NOT NULL,
	`refund_amount` integer NOT NULL,
	`supply_amount` integer NOT NULL,
	`fee_amount` integer NOT NULL,
	`share_amount` integer NOT NULL,
	`withholding_amount` integer NOT NULL,
	`net_amount` integer NOT NULL,
	`backer_count` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`paid_at` integer,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `funding_projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `funding_project_payouts_project_id_unique` ON `funding_project_payouts` (`project_id`);--> statement-breakpoint
CREATE TABLE `funding_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`creator_id` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`content` text NOT NULL,
	`cover_url` text NOT NULL,
	`og_image_url` text,
	`hero_image_url` text,
	`goal_amount` integer NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`review_status` text DEFAULT 'draft' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`review_note` text,
	`submitted_at` integer,
	`approved_at` integer,
	`rejected_at` integer,
	`creator_terms_version` text,
	`creator_terms_agreed_at` integer,
	`lastmod` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `funding_creators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `funding_projects_slug_unique` ON `funding_projects` (`slug`);--> statement-breakpoint
CREATE TABLE `funding_rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`reward_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`amount` integer NOT NULL,
	`total_quantity` integer,
	`requires_shipping` integer DEFAULT false NOT NULL,
	`estimated_delivery` text NOT NULL,
	`image_url` text,
	`downloads` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`locked_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `funding_projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `funding_rewards_project_reward_unique` ON `funding_rewards` (`project_id`,`reward_id`);