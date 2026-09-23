CREATE TABLE `privacy_access_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target_id` text NOT NULL,
	`result` text NOT NULL,
	`ip` text,
	`at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `privacy_access_logs_at_idx` ON `privacy_access_logs` (`at`);--> statement-breakpoint
CREATE INDEX `privacy_access_logs_target_idx` ON `privacy_access_logs` (`target_id`);