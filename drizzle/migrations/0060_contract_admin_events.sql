CREATE TABLE `contract_admin_events` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_id` text NOT NULL,
	`action` text NOT NULL,
	`actor` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `contract_admin_events_contract_idx` ON `contract_admin_events` (`contract_id`,`at`);