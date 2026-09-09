CREATE TABLE `work_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`service_type` text NOT NULL,
	`song_count` integer NOT NULL,
	`vocal_tuning` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`customer_note` text,
	`started_at` integer,
	`delivered_at` integer,
	`cancelled_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
