CREATE TABLE `contract_template_snapshots` (
	`contract_id` text PRIMARY KEY NOT NULL,
	`template` text NOT NULL,
	`template_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE cascade
);
