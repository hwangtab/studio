CREATE TABLE `show_order_locales` (
	`order_no` text PRIMARY KEY NOT NULL,
	`locale` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_no`) REFERENCES `orders`(`order_no`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "show_order_locales_locale_check" CHECK("show_order_locales"."locale" in ('ko','en'))
);
