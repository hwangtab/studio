CREATE TABLE `room_tenancies` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`room_number` text,
	`tenant_name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`monthly_amount` integer NOT NULL,
	`deposit_amount` integer,
	`start_date` text NOT NULL,
	`end_date` text,
	`ended_on` text,
	`billing_day` integer NOT NULL,
	`next_due_on` text NOT NULL,
	`has_window` integer,
	`furnishings` text,
	`spec_note` text,
	`note` text,
	`contract_id` text,
	`private_enc` text,
	`due_event_id` text,
	`end_event_id` text,
	`gcal_error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `room_tenancies_status_idx` ON `room_tenancies` (`status`,`next_due_on`);--> statement-breakpoint
CREATE TABLE `room_tenancy_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`tenancy_id` text NOT NULL,
	`paid_on` text NOT NULL,
	`amount` integer NOT NULL,
	`for_due_on` text,
	`memo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`tenancy_id`) REFERENCES `room_tenancies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `room_tenancy_payments_tenancy_idx` ON `room_tenancy_payments` (`tenancy_id`,`paid_on`);