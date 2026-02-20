-- Create tables for conversation persistence
-- Run this script in your Oracle database

-- Conversations table
CREATE TABLE conversations (
    id VARCHAR2(36) PRIMARY KEY,
    title VARCHAR2(500) NOT NULL,
    model_id VARCHAR2(100),
    created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL
);

-- Messages table
CREATE TABLE messages (
    id VARCHAR2(36) PRIMARY KEY,
    conversation_id VARCHAR2(36) NOT NULL,
    role VARCHAR2(20) NOT NULL,
    content CLOB,
    tool_calls CLOB,
    tool_call_id VARCHAR2(100),
    created_at TIMESTAMP DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT fk_conversation FOREIGN KEY (conversation_id) 
        REFERENCES conversations(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);

-- Grant permissions if needed
-- GRANT SELECT, INSERT, UPDATE, DELETE ON conversations TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO your_app_user;
