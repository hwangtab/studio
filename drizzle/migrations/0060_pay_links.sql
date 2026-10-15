CREATE TABLE `payment_links` (
	`slug` text PRIMARY KEY NOT NULL,
	`item_name` text NOT NULL,
	`total_amount` integer NOT NULL,
	`expires_on` text,
	`memo` text,
	`closed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
