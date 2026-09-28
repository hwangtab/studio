CREATE TABLE `funding_pledge_items` (
	`id` text PRIMARY KEY NOT NULL,
	`pledge_id` text NOT NULL,
	`position` integer NOT NULL,
	`reward_id` text NOT NULL,
	`reward_title` text NOT NULL,
	`unit_amount` integer NOT NULL,
	`quantity` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`pledge_id`) REFERENCES `funding_pledges`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `funding_pledge_items_pledge_reward_unique` ON `funding_pledge_items` (`pledge_id`,`reward_id`);--> statement-breakpoint
CREATE INDEX `funding_pledge_items_reward_idx` ON `funding_pledge_items` (`reward_id`);