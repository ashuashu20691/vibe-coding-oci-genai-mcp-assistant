# Database Migration for Conversational Context

## Overview

This migration adds support for saving tool narratives and adaptation narratives with conversation messages, as required by Requirements 12.1 and 12.3 of the conversational-multi-agent-system spec.

## What's New

The migration adds two new columns to the `messages` table:
- `tool_narratives`: Stores conversational explanations for tool execution (start, result, error)
- `adaptation_narratives`: Stores explanations of how previous results informed next actions

## Running the Migration

### Prerequisites
- Oracle Database connection configured
- SQLcl or SQL*Plus installed
- Appropriate database permissions (ALTER TABLE)

### Steps

1. Connect to your Oracle database:
   ```bash
   sqlcl username/password@connection_string
   ```

2. Run the migration script:
   ```sql
   @add-conversational-context-columns.sql
   ```

3. Verify the columns were added:
   ```sql
   DESC messages;
   ```

   You should see the new columns:
   - `TOOL_NARRATIVES` (CLOB)
   - `ADAPTATION_NARRATIVES` (CLOB)

## What Gets Saved

### Tool Narratives
Each tool execution generates narratives that are saved as JSON arrays:
```json
[
  {
    "toolCallId": "tool-123",
    "toolName": "run_sql",
    "phase": "start",
    "narrative": "I'm querying the database...",
    "timestamp": "2024-01-01T10:00:00.000Z"
  },
  {
    "toolCallId": "tool-123",
    "toolName": "run_sql",
    "phase": "result",
    "narrative": "I found 5 results from querying the database.",
    "timestamp": "2024-01-01T10:00:05.000Z"
  }
]
```

### Adaptation Narratives
Explanations of how the AI adapted its approach based on previous results:
```json
[
  "Based on what I found from querying the database, I'll now analyze the data to get more specific information.",
  "Using the results from analyzing the data, I'll now generate a visualization."
]
```

## Backward Compatibility

- Existing messages without narratives will have `NULL` values in the new columns
- The application handles `NULL` values gracefully
- No data migration is required for existing messages
- The application will start saving narratives for new messages automatically

## Rollback

If you need to rollback this migration:

```sql
ALTER TABLE messages DROP COLUMN tool_narratives;
ALTER TABLE messages DROP COLUMN adaptation_narratives;
```

Note: This will permanently delete all saved narratives.

## Testing

After running the migration, you can verify it works by:

1. Starting a new conversation in the application
2. Asking the AI to perform a task that uses tools (e.g., "Show me data from the database")
3. Checking the database to see if narratives were saved:

```sql
SELECT id, role, 
       DBMS_LOB.SUBSTR(tool_narratives, 100, 1) as tool_narratives_preview,
       DBMS_LOB.SUBSTR(adaptation_narratives, 100, 1) as adaptation_narratives_preview
FROM messages 
WHERE tool_narratives IS NOT NULL 
   OR adaptation_narratives IS NOT NULL
ORDER BY created_at DESC
FETCH FIRST 5 ROWS ONLY;
```

## Support

If you encounter any issues with the migration, check:
1. Database connection is working
2. User has ALTER TABLE permissions
3. Table `messages` exists
4. No active transactions are blocking the ALTER TABLE operation
