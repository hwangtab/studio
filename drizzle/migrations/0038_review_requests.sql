CREATE TABLE `review_requests` (
	`kind` text NOT NULL,
	`ref_id` text NOT NULL,
	`order_id` text NOT NULL,
	`sent_at` integer NOT NULL,
	PRIMARY KEY(`kind`, `ref_id`),
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `review_requests_order_idx` ON `review_requests` (`order_id`);