PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_funding_project_services` (
	`project_id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`design_fee` integer NOT NULL,
	`design_fee_paid_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `funding_projects`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "funding_project_services_kind_check" CHECK("__new_funding_project_services"."kind" in ('design', 'release', 'none'))
);
--> statement-breakpoint
INSERT INTO `__new_funding_project_services`("project_id", "kind", "design_fee", "design_fee_paid_at", "created_at", "updated_at") SELECT "project_id", "kind", "design_fee", "design_fee_paid_at", "created_at", "updated_at" FROM `funding_project_services`;--> statement-breakpoint
DROP TABLE `funding_project_services`;--> statement-breakpoint
ALTER TABLE `__new_funding_project_services` RENAME TO `funding_project_services`;--> statement-breakpoint
PRAGMA foreign_keys=ON;