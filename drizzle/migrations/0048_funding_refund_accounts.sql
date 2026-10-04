CREATE TABLE `funding_refund_accounts` (
	`order_id` text PRIMARY KEY NOT NULL,
	`bank_name` text NOT NULL,
	`account_number_enc` text NOT NULL,
	`account_holder` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
