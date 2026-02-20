-- Migration script to add model_id column to conversations table
-- Run this script in your Oracle database to support model selection persistence

-- Add model_id column to conversations table
ALTER TABLE conversations ADD (
    model_id VARCHAR2(100)
);

-- Create index for model_id lookups (optional, for performance)
CREATE INDEX idx_conversations_model ON conversations(model_id);

-- Verify the column was added
SELECT column_name, data_type, data_length 
FROM user_tab_columns 
WHERE table_name = 'CONVERSATIONS' 
AND column_name = 'MODEL_ID';
