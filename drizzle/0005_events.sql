CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`note` text,
	`startDate` text,
	`endDate` text,
	`userId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_user_title_unique` ON `events` (`userId`,`title`);--> statement-breakpoint
ALTER TABLE `expenses` ADD `eventId` text;--> statement-breakpoint
CREATE INDEX `expenses_user_event_idx` ON `expenses` (`userId`,`eventId`);