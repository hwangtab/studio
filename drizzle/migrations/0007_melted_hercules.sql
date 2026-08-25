CREATE TABLE `availability_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`service_type` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`duration_hours` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`gcal_event_id` text,
	`gcal_error` text,
	`customer_note` text,
	`cancelled_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_no` text NOT NULL,
	`type` text DEFAULT 'session' NOT NULL,
	`customer_name` text NOT NULL,
	`customer_phone` text NOT NULL,
	`customer_email` text NOT NULL,
	`item_amount` integer NOT NULL,
	`vat_amount` integer NOT NULL,
	`total_amount` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`manage_token` text NOT NULL,
	`notification_error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_no_unique` ON `orders` (`order_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_manage_token_unique` ON `orders` (`manage_token`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`payment_key` text NOT NULL,
	`method` text,
	`approved_at` integer,
	`receipt_url` text,
	`raw_response` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_payment_key_unique` ON `payments` (`payment_key`);--> statement-breakpoint
CREATE TABLE `refunds` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text NOT NULL,
	`amount` integer NOT NULL,
	`reason` text NOT NULL,
	`requested_by` text NOT NULL,
	`toss_transaction_key` text,
	`status` text DEFAULT 'done' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`event_key` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`processed_at` integer DEFAULT (unixepoch()) NOT NULL
);
