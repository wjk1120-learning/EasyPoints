USE easy_points;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'easy_points'
    AND TABLE_NAME = 'message_outbox'
    AND COLUMN_NAME = 'read_at'
);

SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE message_outbox ADD COLUMN read_at TIMESTAMP NULL DEFAULT NULL AFTER retry_count',
  'SELECT ''message_outbox.read_at already exists'''
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
