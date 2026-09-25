DROP INDEX `funding_projects_slug_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `funding_projects_slug_live_unique` ON `funding_projects` (`slug`) WHERE review_status <> 'rejected';