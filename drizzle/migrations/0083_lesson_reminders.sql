CREATE TABLE `lesson_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`ref_id` text NOT NULL,
	`sent_at` integer DEFAULT (unixepoch()) NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lesson_reminders_kind_ref_uq` ON `lesson_reminders` (`kind`,`ref_id`);