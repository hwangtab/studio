CREATE TABLE `lesson_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`student_name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`pay_method` text NOT NULL,
	`subscription_id` text,
	`course_weeks` integer NOT NULL,
	`start_date` text NOT NULL,
	`start_time` text NOT NULL,
	`duration_min` integer DEFAULT 60 NOT NULL,
	`monthly_amount` integer NOT NULL,
	`note` text,
	`ended_on` text,
	`ended_reason` text,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "lesson_enrollments_status_check" CHECK("lesson_enrollments"."status" in ('active','completed','ended')),
	CONSTRAINT "lesson_enrollments_pay_method_check" CHECK("lesson_enrollments"."pay_method" in ('card','bank','cash')),
	CONSTRAINT "lesson_enrollments_weeks_check" CHECK("lesson_enrollments"."course_weeks" in (12,24))
);
--> statement-breakpoint
CREATE INDEX `lesson_enrollments_status_idx` ON `lesson_enrollments` (`status`,`start_date`);--> statement-breakpoint
CREATE TABLE `lesson_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`enrollment_id` text NOT NULL,
	`paid_on` text NOT NULL,
	`amount` integer NOT NULL,
	`vat_amount` integer DEFAULT 0 NOT NULL,
	`period_label` text NOT NULL,
	`method` text NOT NULL,
	`memo` text,
	`receipt_issued` integer DEFAULT false NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	`deleted_by` text,
	FOREIGN KEY (`enrollment_id`) REFERENCES `lesson_enrollments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `lesson_payments_paid_on_idx` ON `lesson_payments` (`paid_on`);--> statement-breakpoint
CREATE INDEX `lesson_payments_enrollment_idx` ON `lesson_payments` (`enrollment_id`);--> statement-breakpoint
CREATE TABLE `lesson_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`enrollment_id` text NOT NULL,
	`seq` integer NOT NULL,
	`scheduled_on` text NOT NULL,
	`start_time` text NOT NULL,
	`duration_min` integer NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`block_id` text,
	`extends_session_id` text,
	`topic` text,
	`homework` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`enrollment_id`) REFERENCES `lesson_enrollments`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "lesson_sessions_status_check" CHECK("lesson_sessions"."status" in ('scheduled','done','absent','studio_cancelled','dropped'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lesson_sessions_enrollment_seq_uq` ON `lesson_sessions` (`enrollment_id`,`seq`);--> statement-breakpoint
CREATE INDEX `lesson_sessions_date_idx` ON `lesson_sessions` (`scheduled_on`,`status`);