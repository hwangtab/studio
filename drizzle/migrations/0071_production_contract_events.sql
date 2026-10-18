CREATE TABLE `production_contract_events` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_id` text NOT NULL,
	`seq` integer NOT NULL,
	`type` text NOT NULL,
	`stage` text,
	`amount` integer,
	`data_json` text,
	`occurred_at` integer NOT NULL,
	`recorded_at` integer NOT NULL,
	`actor` text NOT NULL,
	`actor_ip` text,
	`voids_event_id` text,
	`notice_status` text DEFAULT 'none' NOT NULL,
	`notice_sent_at` integer,
	`notice_error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `production_contracts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "production_contract_events_type_check" CHECK("production_contract_events"."type" in ('payment_received','source_received','source_replaced','kickoff','stage_delivered','recording_completed','revision_requested','stage_approved','pause_started','pause_ended','extra_cost_agreed','client_contacted','client_responded','final_delivered','distribution_submitted','released','termination_notice','reminder_sent','note','void')),
	CONSTRAINT "production_contract_events_notice_check" CHECK("production_contract_events"."notice_status" in ('none','pending','sent','failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_contract_events_seq_uq` ON `production_contract_events` (`contract_id`,`seq`);