ALTER TABLE `funding_project_payouts` ADD `design_fee_offset_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `funding_project_payouts` ADD `production_fee_offset_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `funding_project_payouts` ADD `shortfall_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `funding_project_services` ADD `production_fee` integer DEFAULT 0 NOT NULL;