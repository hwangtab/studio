CREATE TABLE `funding_project_services` (
	`project_id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`design_fee` integer NOT NULL,
	`design_fee_paid_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `funding_projects`(`id`) ON UPDATE no action ON DELETE no action
);
