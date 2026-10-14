CREATE TABLE `software_orders` (
	`order_no` text PRIMARY KEY NOT NULL,
	`product_slug` text NOT NULL,
	`price_id` text NOT NULL,
	`product_title` text NOT NULL,
	`unit_price` integer NOT NULL,
	`currency` text DEFAULT 'KRW' NOT NULL,
	`withdrawal_ack_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
