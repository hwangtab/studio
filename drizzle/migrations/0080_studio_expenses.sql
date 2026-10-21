CREATE TABLE `studio_expenses` (
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
	CONSTRAINT "studio_expenses_category_check" CHECK("studio_expenses"."category" in ('rent','cleaning','utilities','maintenance','supplies','other')),
	CONSTRAINT "studio_expenses_scope_check" CHECK("studio_expenses"."scope" in ('practice','studio'))
);
--> statement-breakpoint
CREATE INDEX `studio_expenses_spent_on_idx` ON `studio_expenses` (`spent_on`);