CREATE TABLE `revenue_line_assignments` (
	`subject_kind` text NOT NULL,
	`subject_id` text NOT NULL,
	`business_line` text NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`subject_kind`, `subject_id`),
	CONSTRAINT "revenue_line_assignments_subject_check" CHECK("revenue_line_assignments"."subject_kind" in ('payment_link','manual_revenue')),
	CONSTRAINT "revenue_line_assignments_line_check" CHECK("revenue_line_assignments"."business_line" in ('practice','recording','platform','other'))
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_studio_expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`spent_on` text NOT NULL,
	`category` text NOT NULL,
	`scope` text DEFAULT 'practice' NOT NULL,
	`description` text NOT NULL,
	`amount` integer NOT NULL,
	`repeat_monthly` integer DEFAULT false NOT NULL,
	`repeat_until` text,
	`memo` text,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	`deleted_by` text,
	CONSTRAINT "studio_expenses_category_check" CHECK("__new_studio_expenses"."category" in ('rent','cleaning','utilities','maintenance','supplies','other','loan_principal')),
	CONSTRAINT "studio_expenses_scope_check" CHECK("__new_studio_expenses"."scope" in ('practice','studio','recording','platform'))
);
--> statement-breakpoint
INSERT INTO `__new_studio_expenses`("id", "spent_on", "category", "scope", "description", "amount", "repeat_monthly", "repeat_until", "memo", "created_by", "created_at", "deleted_at", "deleted_by") SELECT "id", "spent_on", "category", "scope", "description", "amount", "repeat_monthly", "repeat_until", "memo", "created_by", "created_at", "deleted_at", "deleted_by" FROM `studio_expenses`;--> statement-breakpoint
DROP TABLE `studio_expenses`;--> statement-breakpoint
ALTER TABLE `__new_studio_expenses` RENAME TO `studio_expenses`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `studio_expenses_spent_on_idx` ON `studio_expenses` (`spent_on`);