ALTER TABLE `orders` ADD `payment_fail_code` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_fail_message` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_failed_at` integer;