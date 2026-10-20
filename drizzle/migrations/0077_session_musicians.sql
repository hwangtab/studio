CREATE TABLE `session_musicians` (
	`id` text PRIMARY KEY NOT NULL,
	`stage_name` text NOT NULL,
	`primary_instrument` text NOT NULL,
	`instruments_json` text,
	`genres_json` text,
	`years_experience` integer,
	`reading` text,
	`remote_recording` integer,
	`region` text,
	`bio` text,
	`sample_links_json` text NOT NULL,
	`rate_note` text,
	`adult_confirmed` integer NOT NULL,
	`private_enc` text NOT NULL,
	`email_hash` text NOT NULL,
	`manage_token_hash` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`operator_memo` text,
	`consent_version` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_confirmed_at` integer DEFAULT (unixepoch()) NOT NULL,
	`reconfirm_sent_at` integer,
	CONSTRAINT "session_musicians_status_check" CHECK("session_musicians"."status" in ('new','reviewed','active','inactive')),
	CONSTRAINT "session_musicians_reading_check" CHECK("session_musicians"."reading" is null or "session_musicians"."reading" in ('chart','staff','none'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_musicians_email_hash_uq` ON `session_musicians` (`email_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_musicians_manage_token_uq` ON `session_musicians` (`manage_token_hash`);--> statement-breakpoint
CREATE INDEX `session_musicians_status_idx` ON `session_musicians` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `session_musicians_confirmed_idx` ON `session_musicians` (`last_confirmed_at`);