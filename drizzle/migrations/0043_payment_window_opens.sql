CREATE TABLE `payment_window_opens` (
	`order_id` text PRIMARY KEY NOT NULL,
	`first_opened_at` integer NOT NULL,
	`last_opened_at` integer NOT NULL,
	`open_count` integer DEFAULT 1 NOT NULL,
	`browser` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
