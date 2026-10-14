CREATE TABLE `shop_artists` (
	`creator_id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`curated_slug_linked` integer DEFAULT false NOT NULL,
	`profile_image_url` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `funding_creators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shop_artists_slug_unique` ON `shop_artists` (`slug`);--> statement-breakpoint
CREATE TABLE `shop_order_downloads` (
	`order_no` text PRIMARY KEY NOT NULL,
	`first_downloaded_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_no`) REFERENCES `orders`(`order_no`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shop_product_skus` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`option_label` text,
	`price` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`retired` integer DEFAULT false NOT NULL,
	`locked_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `shop_products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "shop_product_skus_price_check" CHECK("shop_product_skus"."price" > 0)
);
--> statement-breakpoint
CREATE INDEX `shop_product_skus_product_idx` ON `shop_product_skus` (`product_id`);--> statement-breakpoint
CREATE TABLE `shop_products` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_id` text NOT NULL,
	`slug` text NOT NULL,
	`category` text NOT NULL,
	`kind` text DEFAULT 'physical' NOT NULL,
	`title` text NOT NULL,
	`subtitle` text,
	`description` text DEFAULT '' NOT NULL,
	`images` text DEFAULT '[]' NOT NULL,
	`ships_on` text,
	`edition_size` integer,
	`digital_files` text,
	`review_status` text DEFAULT 'draft' NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`review_note` text,
	`internal_note` text,
	`submitted_at` integer,
	`approved_at` integer,
	`rejected_at` integer,
	`creator_edited_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `funding_creators`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "shop_products_category_check" CHECK("shop_products"."category" in ('album','goods')),
	CONSTRAINT "shop_products_kind_check" CHECK("shop_products"."kind" in ('physical','digital')),
	CONSTRAINT "shop_products_edition_check" CHECK("shop_products"."edition_size" IS NULL OR "shop_products"."edition_size" > 0)
);
--> statement-breakpoint
CREATE INDEX `shop_products_creator_idx` ON `shop_products` (`creator_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `shop_products_slug_live_unique` ON `shop_products` (`slug`) WHERE review_status <> 'rejected';--> statement-breakpoint
CREATE TABLE `shop_serials` (
	`product_id` text NOT NULL,
	`serial` integer NOT NULL,
	`order_no` text NOT NULL,
	`order_item_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_no`) REFERENCES `orders`(`order_no`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shop_serials_product_serial_unique` ON `shop_serials` (`product_id`,`serial`);--> statement-breakpoint
CREATE INDEX `shop_serials_order_idx` ON `shop_serials` (`order_no`);--> statement-breakpoint
CREATE INDEX `shop_serials_item_idx` ON `shop_serials` (`order_item_id`);