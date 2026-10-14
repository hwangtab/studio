CREATE TABLE `shop_artist_terms_agreements` (
	`creator_id` text NOT NULL,
	`terms_version` text NOT NULL,
	`agreed_at` integer NOT NULL,
	PRIMARY KEY(`creator_id`, `terms_version`),
	FOREIGN KEY (`creator_id`) REFERENCES `funding_creators`(`id`) ON UPDATE no action ON DELETE no action
);
