CREATE TABLE `shop_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_no` text NOT NULL,
	`sku_id` text NOT NULL,
	`product_slug` text NOT NULL,
	`product_title` text NOT NULL,
	`option_label` text,
	`unit_price` integer NOT NULL,
	`quantity` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_no`) REFERENCES `orders`(`order_no`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "shop_order_items_quantity_check" CHECK("shop_order_items"."quantity" > 0),
	CONSTRAINT "shop_order_items_unit_price_check" CHECK("shop_order_items"."unit_price" >= 0)
);
--> statement-breakpoint
CREATE INDEX `shop_order_items_order_idx` ON `shop_order_items` (`order_no`);--> statement-breakpoint
CREATE INDEX `shop_order_items_sku_idx` ON `shop_order_items` (`sku_id`);--> statement-breakpoint
CREATE TABLE `shop_orders` (
	`order_no` text PRIMARY KEY NOT NULL,
	`recipient_name` text NOT NULL,
	`recipient_phone` text NOT NULL,
	`postcode` text NOT NULL,
	`address1` text NOT NULL,
	`address2` text,
	`shipping_memo` text,
	`subtotal_amount` integer NOT NULL,
	`shipping_fee` integer NOT NULL,
	`hold_expires_at` integer NOT NULL,
	`fulfillment_status` text DEFAULT 'preparing' NOT NULL,
	`courier` text,
	`tracking_number` text,
	`shipped_at` integer,
	`delivered_at` integer,
	`cancelled_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_no`) REFERENCES `orders`(`order_no`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "shop_orders_fulfillment_check" CHECK("shop_orders"."fulfillment_status" in ('preparing','shipped','delivered','cancelled'))
);
--> statement-breakpoint
CREATE TABLE `shop_skus` (
	`id` text PRIMARY KEY NOT NULL,
	`product_slug` text NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "shop_skus_stock_check" CHECK("shop_skus"."stock" >= 0)
);
