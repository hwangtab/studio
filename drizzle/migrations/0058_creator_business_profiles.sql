CREATE TABLE `creator_business_profiles` (
	`creator_id` text PRIMARY KEY NOT NULL,
	`business_number` text NOT NULL,
	`business_name` text NOT NULL,
	`representative_name` text NOT NULL,
	`nts_status` text DEFAULT 'unverified' NOT NULL,
	`nts_tax_type_code` text,
	`nts_tax_type_label` text,
	`nts_checked_at` integer,
	`nts_check_error` text,
	`certificate_key` text,
	`certificate_content_type` text,
	`certificate_uploaded_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `funding_creators`(`id`) ON UPDATE no action ON DELETE no action
);
