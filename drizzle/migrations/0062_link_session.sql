ALTER TABLE `payment_link_orders` ADD `session_at` integer;--> statement-breakpoint
ALTER TABLE `payment_link_orders` ADD `session_hours` integer;--> statement-breakpoint
ALTER TABLE `payment_links` ADD `session_at` integer;--> statement-breakpoint
ALTER TABLE `payment_links` ADD `session_hours` integer;--> statement-breakpoint
ALTER TABLE `payment_links` ADD `block_id` text;