CREATE TABLE `agent_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`session_id` text,
	`cwd` text DEFAULT '' NOT NULL,
	`branch` text,
	`prompt` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`steps` text DEFAULT '[]' NOT NULL,
	`files` text DEFAULT '[]' NOT NULL,
	`patch` text DEFAULT '' NOT NULL,
	`patch_truncated` integer DEFAULT false NOT NULL,
	`base_commit` text,
	`base_untracked` text DEFAULT '[]' NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_turns_project_started_idx` ON `agent_turns` (`project_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`kind` text DEFAULT 'reference' NOT NULL,
	`requirement_id` text,
	`dod_item_id` text,
	`feature_id` text,
	`title` text DEFAULT '' NOT NULL,
	`route` text DEFAULT '' NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`data` blob NOT NULL,
	`created_by` text DEFAULT 'user:local' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requirement_id`) REFERENCES `requirements`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`dod_item_id`) REFERENCES `dod_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`feature_id`) REFERENCES `features`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `attachments_project_idx` ON `attachments` (`project_id`);--> statement-breakpoint
ALTER TABLE `requirements` ADD `type` text DEFAULT 'functional' NOT NULL;--> statement-breakpoint
ALTER TABLE `requirements` ADD `area` text DEFAULT 'general' NOT NULL;