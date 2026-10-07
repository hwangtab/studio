CREATE TABLE `show_report_links` (
	`id` text PRIMARY KEY NOT NULL,
	`show_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`label` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `show_report_links_token_hash_unique` ON `show_report_links` (`token_hash`);--> statement-breakpoint
CREATE INDEX `show_report_links_show_idx` ON `show_report_links` (`show_id`);