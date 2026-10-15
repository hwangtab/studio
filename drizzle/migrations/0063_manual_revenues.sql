CREATE TABLE `manual_revenues` (
	`id` text PRIMARY KEY NOT NULL,
	`received_on` text NOT NULL,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`total_amount` integer NOT NULL,
	`vat_amount` integer DEFAULT 0 NOT NULL,
	`refunded_amount` integer DEFAULT 0 NOT NULL,
	`method` text NOT NULL,
	`memo` text,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `manual_revenues_received_on_idx` ON `manual_revenues` (`received_on`);