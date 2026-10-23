PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_production_contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`title` text NOT NULL,
	`client_name` text NOT NULL,
	`client_stage_name` text,
	`client_email` text NOT NULL,
	`client_phone` text NOT NULL,
	`client_birthdate` text,
	`client_address` text,
	`terms_json` text NOT NULL,
	`total_amount` integer NOT NULL,
	`clauses_json` text NOT NULL,
	`template` text NOT NULL,
	`template_hash` text NOT NULL,
	`content` text NOT NULL,
	`content_hash` text,
	`sent_at` integer,
	`expires_at` integer,
	`signed_at` integer,
	`pdf_url` text,
	`pdf_generated_at` integer,
	`notification_error` text,
	`notified_at` integer,
	`completed_at` integer,
	`terminated_at` integer,
	`termination_reason` text,
	`purged_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "production_contracts_kind_check" CHECK("__new_production_contracts"."kind" in ('single','ep','album','mixmaster','rework')),
	CONSTRAINT "production_contracts_status_check" CHECK("__new_production_contracts"."status" in ('draft','sent','signed','cancelled','expired','completed','terminated'))
);
--> statement-breakpoint
INSERT INTO `__new_production_contracts`("id", "kind", "status", "title", "client_name", "client_stage_name", "client_email", "client_phone", "client_birthdate", "client_address", "terms_json", "total_amount", "clauses_json", "template", "template_hash", "content", "content_hash", "sent_at", "expires_at", "signed_at", "pdf_url", "pdf_generated_at", "notification_error", "notified_at", "completed_at", "terminated_at", "termination_reason", "purged_at", "created_at", "updated_at") SELECT "id", "kind", "status", "title", "client_name", "client_stage_name", "client_email", "client_phone", "client_birthdate", "client_address", "terms_json", "total_amount", "clauses_json", "template", "template_hash", "content", "content_hash", "sent_at", "expires_at", "signed_at", "pdf_url", "pdf_generated_at", "notification_error", "notified_at", "completed_at", "terminated_at", "termination_reason", "purged_at", "created_at", "updated_at" FROM `production_contracts`;--> statement-breakpoint
DROP TABLE `production_contracts`;--> statement-breakpoint
ALTER TABLE `__new_production_contracts` RENAME TO `production_contracts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `production_contracts_status_idx` ON `production_contracts` (`status`,`created_at`);