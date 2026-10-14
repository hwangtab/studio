CREATE TABLE `software_activations` (
	`id` text PRIMARY KEY NOT NULL,
	`license_id` text NOT NULL,
	`machine_id` text NOT NULL,
	`label` text,
	`app_version` text,
	`activated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deactivated_at` integer,
	FOREIGN KEY (`license_id`) REFERENCES `software_licenses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `software_activations_license_machine_idx` ON `software_activations` (`license_id`,`machine_id`);--> statement-breakpoint
CREATE TABLE `software_licenses` (
	`id` text PRIMARY KEY NOT NULL,
	`product_slug` text NOT NULL,
	`license_key` text NOT NULL,
	`email` text NOT NULL,
	`customer_name` text,
	`source` text NOT NULL,
	`order_no` text,
	`note` text,
	`max_activations` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`issued_at` integer DEFAULT (unixepoch()) NOT NULL,
	`first_activated_at` integer,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `software_licenses_license_key_unique` ON `software_licenses` (`license_key`);--> statement-breakpoint
CREATE INDEX `software_licenses_email_idx` ON `software_licenses` (`email`);--> statement-breakpoint
CREATE INDEX `software_licenses_order_no_idx` ON `software_licenses` (`order_no`);