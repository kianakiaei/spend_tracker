CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text,
	`color` text,
	`kind` text NOT NULL,
	`order` integer NOT NULL,
	`slug` text,
	`userId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_user_name_unique` ON `categories` (`userId`,`name`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`amountToman` integer NOT NULL,
	`title` text NOT NULL,
	`note` text,
	`categoryId` text NOT NULL,
	`occurredAt` text,
	`monthKey` text NOT NULL,
	`sourceRecurringId` text,
	`userId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expenses_user_source_recurring_month_unique` ON `expenses` (`userId`,`sourceRecurringId`,`monthKey`);--> statement-breakpoint
CREATE INDEX `expenses_user_month_idx` ON `expenses` (`userId`,`monthKey`);--> statement-breakpoint
CREATE TABLE `learnedKeys` (
	`key` text NOT NULL,
	`categoryId` text NOT NULL,
	`count` integer NOT NULL,
	`source` text DEFAULT 'learned' NOT NULL,
	`userId` text NOT NULL,
	`updatedAt` integer NOT NULL,
	PRIMARY KEY(`userId`, `key`)
);
--> statement-breakpoint
CREATE TABLE `recurringTemplates` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`amountToman` integer NOT NULL,
	`categoryId` text NOT NULL,
	`dayOfMonth` integer NOT NULL,
	`startDate` text NOT NULL,
	`endDate` text,
	`active` integer DEFAULT true NOT NULL,
	`userId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
