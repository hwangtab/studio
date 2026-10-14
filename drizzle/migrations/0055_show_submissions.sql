CREATE TABLE `show_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_id` text NOT NULL,
	`show_id` text,
	`draft_json` text NOT NULL,
	`approved_draft_json` text,
	`review_status` text DEFAULT 'draft' NOT NULL,
	`review_note` text,
	`internal_note` text,
	`organizer_terms_version` text,
	`organizer_terms_agreed_at` integer,
	`submitted_at` integer,
	`approved_at` integer,
	`rejected_at` integer,
	`organizer_edited_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`creator_id`) REFERENCES `funding_creators`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `show_submissions_creator_idx` ON `show_submissions` (`creator_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `show_submissions_show_idx` ON `show_submissions` (`show_id`);