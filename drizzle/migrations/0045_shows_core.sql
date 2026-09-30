CREATE TABLE `show_orders` (
	`order_no` text PRIMARY KEY NOT NULL,
	`showtime_id` text NOT NULL,
	`buyer_name` text NOT NULL,
	`buyer_contact` text NOT NULL,
	`hold_expires_at` integer,
	`auto_cancelled_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_no`) REFERENCES `orders`(`order_no`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`showtime_id`) REFERENCES `showtimes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `show_orders_showtime_idx` ON `show_orders` (`showtime_id`);--> statement-breakpoint
CREATE TABLE `show_scan_links` (
	`id` text PRIMARY KEY NOT NULL,
	`showtime_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`label` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`showtime_id`) REFERENCES `showtimes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `show_scan_links_token_hash_unique` ON `show_scan_links` (`token_hash`);--> statement-breakpoint
CREATE INDEX `show_scan_links_showtime_idx` ON `show_scan_links` (`showtime_id`);--> statement-breakpoint
CREATE TABLE `show_ticket_types` (
	`id` text PRIMARY KEY NOT NULL,
	`show_id` text NOT NULL,
	`zone_id` text NOT NULL,
	`name` text NOT NULL,
	`price` integer NOT NULL,
	`quota` integer,
	`comp_quota` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`zone_id`) REFERENCES `show_zones`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "show_ticket_types_price_check" CHECK("show_ticket_types"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE `show_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`order_no` text NOT NULL,
	`showtime_id` text NOT NULL,
	`ticket_type_id` text NOT NULL,
	`code` text NOT NULL,
	`entry_number` integer,
	`status` text DEFAULT 'held' NOT NULL,
	`issued_by` text DEFAULT 'customer' NOT NULL,
	`unit_amount` integer NOT NULL,
	`compensated_amount` integer DEFAULT 0 NOT NULL,
	`compensated_at` integer,
	`checked_in_at` integer,
	`checked_in_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_no`) REFERENCES `orders`(`order_no`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`showtime_id`) REFERENCES `showtimes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ticket_type_id`) REFERENCES `show_ticket_types`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "show_tickets_status_check" CHECK("show_tickets"."status" in ('held','issued','refunding','refunded','void'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `show_tickets_code_unique` ON `show_tickets` (`code`);--> statement-breakpoint
CREATE INDEX `show_tickets_showtime_type_idx` ON `show_tickets` (`showtime_id`,`ticket_type_id`);--> statement-breakpoint
CREATE INDEX `show_tickets_order_idx` ON `show_tickets` (`order_no`);--> statement-breakpoint
CREATE TABLE `show_zones` (
	`id` text PRIMARY KEY NOT NULL,
	`show_id` text NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`capacity` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "show_zones_capacity_check" CHECK("show_zones"."capacity" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `show_zones_show_code_unique` ON `show_zones` (`show_id`,`code`);--> statement-breakpoint
CREATE TABLE `shows` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`presenter_name` text NOT NULL,
	`performers` text NOT NULL,
	`age_rating` text NOT NULL,
	`running_minutes` integer NOT NULL,
	`venue_name` text NOT NULL,
	`venue_address` text NOT NULL,
	`description` text NOT NULL,
	`cover_image` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`notice_key` text DEFAULT (lower(hex(randomblob(8)))) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "shows_status_check" CHECK("shows"."status" in ('draft','published','cancelled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shows_slug_unique` ON `shows` (`slug`);--> statement-breakpoint
CREATE TABLE `showtimes` (
	`id` text PRIMARY KEY NOT NULL,
	`show_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`previous_starts_at` integer,
	`sales_close_at` integer NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`changed_at` integer DEFAULT (unixepoch()) NOT NULL,
	`cancelled_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "showtimes_status_check" CHECK("showtimes"."status" in ('scheduled','cancelled','ended'))
);
--> statement-breakpoint
CREATE INDEX `showtimes_show_starts_idx` ON `showtimes` (`show_id`,`starts_at`);