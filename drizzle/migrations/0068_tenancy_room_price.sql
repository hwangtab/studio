ALTER TABLE `room_tenancies` ADD `room_list_price` integer;--> statement-breakpoint
UPDATE `room_tenancies` SET `room_list_price` = CAST(`spec_note` AS integer) * 10000 WHERE `spec_note` GLOB '[0-9]*' AND CAST(`spec_note` AS integer) BETWEEN 1 AND 9999;
