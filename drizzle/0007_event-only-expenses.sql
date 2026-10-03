DROP INDEX "categories_user_name_unique";--> statement-breakpoint
DROP INDEX "events_user_title_unique";--> statement-breakpoint
DROP INDEX "expenses_user_source_recurring_month_unique";--> statement-breakpoint
DROP INDEX "expenses_user_month_idx";--> statement-breakpoint
DROP INDEX "expenses_user_event_idx";--> statement-breakpoint
DROP INDEX "session_token_unique";--> statement-breakpoint
DROP INDEX "user_email_unique";--> statement-breakpoint
ALTER TABLE `expenses` ALTER COLUMN "categoryId" TO "categoryId" text;--> statement-breakpoint
CREATE UNIQUE INDEX `categories_user_name_unique` ON `categories` (`userId`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `events_user_title_unique` ON `events` (`userId`,`title`);--> statement-breakpoint
CREATE UNIQUE INDEX `expenses_user_source_recurring_month_unique` ON `expenses` (`userId`,`sourceRecurringId`,`monthKey`);--> statement-breakpoint
CREATE INDEX `expenses_user_month_idx` ON `expenses` (`userId`,`monthKey`);--> statement-breakpoint
CREATE INDEX `expenses_user_event_idx` ON `expenses` (`userId`,`eventId`);--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);