-- Migration: Add active_artifact column to conversations table
-- Task: 19.8 - Implement artifact persistence across turns
-- Validates: Requirement 15.6 - Artifact persistence across turns

-- Add active_artifact column to store serialized artifact JSON
-- Using CLOB to support large artifacts (charts, dashboards, etc.)
ALTER TABLE conversations ADD (
  active_artifact CLOB
);

-- Add comment to document the column
COMMENT ON COLUMN conversations.active_artifact IS 'Serialized JSON of the active artifact for this conversation. Persists across turns until explicitly cleared or replaced.';

-- Verify the column was added
SELECT column_name, data_type, nullable
FROM user_tab_columns
WHERE table_name = 'CONVERSATIONS'
AND column_name = 'ACTIVE_ARTIFACT';
