PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_learnedKeys` (
	`key` text NOT NULL,
	`categoryId` text NOT NULL,
	`count` integer NOT NULL,
	`source` text DEFAULT 'learned' NOT NULL,
	`userId` text NOT NULL,
	`updatedAt` integer NOT NULL,
	PRIMARY KEY(`userId`, `key`, `categoryId`)
);
--> statement-breakpoint
INSERT INTO `__new_learnedKeys`("key", "categoryId", "count", "source", "userId", "updatedAt") SELECT "key", "categoryId", "count", "source", "userId", "updatedAt" FROM `learnedKeys`;--> statement-breakpoint
DROP TABLE `learnedKeys`;--> statement-breakpoint
ALTER TABLE `__new_learnedKeys` RENAME TO `learnedKeys`;--> statement-breakpoint
PRAGMA foreign_keys=ON;