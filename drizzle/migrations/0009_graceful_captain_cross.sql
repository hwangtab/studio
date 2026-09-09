CREATE TABLE `social_tokens` (
	`platform` text PRIMARY KEY NOT NULL,
	`access_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
