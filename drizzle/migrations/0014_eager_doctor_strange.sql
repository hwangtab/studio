CREATE TABLE `press_optouts` (
	`id` text PRIMARY KEY NOT NULL,
	`email_hash` text NOT NULL,
	`campaign_slug` text NOT NULL,
	`source` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `press_optouts_email_hash_unique` ON `press_optouts` (`email_hash`);