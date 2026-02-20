-- Add columns for conversational context to messages table
-- This supports Requirements 12.1 and 12.3: saving tool narratives and adaptation narratives

-- Add tool_narratives column to store conversational explanations for tool execution
ALTER TABLE messages ADD (
    tool_narratives CLOB,
    adaptation_narratives CLOB
);

-- Comments for documentation
COMMENT ON COLUMN messages.tool_narratives IS 'JSON array of tool narratives (start, result, error explanations)';
COMMENT ON COLUMN messages.adaptation_narratives IS 'JSON array of adaptation narratives explaining how results informed next actions';
