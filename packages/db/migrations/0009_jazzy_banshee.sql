ALTER TABLE `projects` ADD `structure` text DEFAULT 'single' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `parts` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `monorepo_tool` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `test_types` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `requirements` ADD `parts` text DEFAULT '[]' NOT NULL;