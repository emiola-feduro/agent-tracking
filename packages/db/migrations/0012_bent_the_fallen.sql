ALTER TABLE `requirements` ADD `code` text;--> statement-breakpoint
UPDATE `requirements` SET `code` = (CASE `type` WHEN 'non_functional' THEN 'RNF' ELSE 'RF' END) || (
  SELECT count(*) FROM `requirements` AS r2
  WHERE r2.`project_id` = `requirements`.`project_id`
    AND r2.`type` = `requirements`.`type`
    AND (r2.`created_at` < `requirements`.`created_at` OR (r2.`created_at` = `requirements`.`created_at` AND r2.`id` <= `requirements`.`id`))
);--> statement-breakpoint
CREATE UNIQUE INDEX `requirements_project_code_idx` ON `requirements` (`project_id`,`code`);
