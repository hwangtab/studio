CREATE TABLE `contract_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`agreed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `contract_clauses` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_id` text NOT NULL,
	`clause_number` text NOT NULL,
	`title` text NOT NULL,
	`agreed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`customer_name` text NOT NULL,
	`customer_birthdate` text,
	`customer_email` text NOT NULL,
	`customer_phone` text NOT NULL,
	`customer_address` text,
	`room_number` text NOT NULL,
	`room_area` text DEFAULT '3m × 2m',
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`monthly_rent` integer NOT NULL,
	`deposit_amount` integer NOT NULL,
	`payment_day` integer DEFAULT 1 NOT NULL,
	`payment_bank` text DEFAULT '카카오뱅크',
	`payment_account` text DEFAULT '3333-12-5480849',
	`payment_account_holder` text DEFAULT '황경하 / 스튜디오 놀',
	`content` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`rules_agreed` integer DEFAULT false NOT NULL,
	`rules_agreed_at` integer,
	`special_terms` text,
	`sent_at` integer,
	`signed_at` integer,
	`expires_at` integer,
	`sign_token` text NOT NULL,
	`sign_token_used_at` integer,
	`pdf_url` text,
	`pdf_generated_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contracts_sign_token_unique` ON `contracts` (`sign_token`);--> statement-breakpoint
CREATE TABLE `signatures` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_id` text NOT NULL,
	`signer_name` text NOT NULL,
	`signer_email` text NOT NULL,
	`signer_role` text DEFAULT 'customer' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`signed_at` integer,
	`ip_address` text,
	`user_agent` text,
	`signature_data` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE cascade
);
