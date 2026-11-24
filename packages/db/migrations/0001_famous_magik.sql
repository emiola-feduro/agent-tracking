CREATE TABLE `agent_events` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`actor` text NOT NULL,
	`type` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_events_project_created_idx` ON `agent_events` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `feature_files` (
	`feature_id` text NOT NULL,
	`file_id` text NOT NULL,
	`created_by` text DEFAULT 'user:local' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	PRIMARY KEY(`feature_id`, `file_id`),
	FOREIGN KEY (`feature_id`) REFERENCES `features`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `file_artifacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `feature_files_file_idx` ON `feature_files` (`file_id`);--> statement-breakpoint
CREATE TABLE `file_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`path` text NOT NULL,
	`purpose` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT 'user:local' NOT NULL,
	`updated_by` text DEFAULT 'user:local' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `file_artifacts_project_path_unique` ON `file_artifacts` (`project_id`,`path`);--> statement-breakpoint
CREATE TABLE `symbols` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`line_start` integer,
	`line_end` integer,
	`purpose` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'reported' NOT NULL,
	`created_by` text DEFAULT 'user:local' NOT NULL,
	`updated_by` text DEFAULT 'user:local' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `file_artifacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `symbols_file_name_kind_unique` ON `symbols` (`file_id`,`name`,`kind`);--> statement-breakpoint
CREATE TABLE `test_ideas` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`feature_id` text,
	`requirement_id` text,
	`text` text NOT NULL,
	`origin` text DEFAULT 'human' NOT NULL,
	`status` text DEFAULT 'proposed' NOT NULL,
	`created_by` text DEFAULT 'user:local' NOT NULL,
	`updated_by` text DEFAULT 'user:local' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`feature_id`) REFERENCES `features`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`requirement_id`) REFERENCES `requirements`(`id`) ON UPDATE no action ON DELETE set null
);
