CREATE TABLE `production_contract_payment_links` (
	`slug` text PRIMARY KEY NOT NULL,
	`contract_id` text NOT NULL,
	`purpose` text NOT NULL,
	`amount` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `production_contracts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `production_contract_payment_links_contract_idx` ON `production_contract_payment_links` (`contract_id`);