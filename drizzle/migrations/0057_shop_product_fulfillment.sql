CREATE TABLE `shop_product_fulfillment` (
	`product_id` text PRIMARY KEY NOT NULL,
	`mode` text DEFAULT 'studio' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `shop_products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "shop_product_fulfillment_mode_check" CHECK("shop_product_fulfillment"."mode" in ('studio','artist'))
);
