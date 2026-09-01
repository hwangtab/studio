ALTER TABLE `contracts` ADD `first_viewed_at` integer;--> statement-breakpoint
ALTER TABLE `contracts` ADD `last_viewed_at` integer;--> statement-breakpoint
ALTER TABLE `contracts` ADD `view_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `contracts` ADD `first_viewed_ip` text;