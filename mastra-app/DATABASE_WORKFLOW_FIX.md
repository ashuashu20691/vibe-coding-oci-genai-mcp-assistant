# Database Connection Workflow Fix

## Problem
The agent was automatically connecting to the first database without asking the user which database to use.

## Solution
Updated the workflow to:
1. **List databases first** using `sqlcl_list_connections`
2. **Show the list to user** and ask which database they want
3. **Only connect** when user specifies the database name
4. **Exception**: If user explicitly mentions a database name in their query, connect directly

## Changes Made

### 1. Chat Route (src/app/api/chat/route.ts)
Updated the instruction prefix in `toChatMessages()` function:

**Before:**
```typescript
const prefix = `[IMPORTANT: Do NOT ask clarifying questions. Connect to the FIRST database automatically. Take action immediately.]\n\n`;
```

**After:**
```typescript
const prefix = `[IMPORTANT DATABASE WORKFLOW:
1. FIRST: List available databases using sqlcl_list_connections
2. THEN: Show the list to the user and ask which database they want to use
3. ONLY connect when user specifies the database name
4. Do NOT automatically connect to any database without user confirmation

Exception: If the user explicitly mentions a database name in their query, you can connect directly to that database.]\n\n`;
```

### 2. Database Agent (src/mastra/agents/database-agent.ts)
Updated `DATABASE_AGENT_INSTRUCTIONS` to include the new workflow:

```typescript
DATABASE CONNECTION WORKFLOW (IMPORTANT):
1. When user asks a database query, FIRST call sqlcl_list_connections to show available databases
2. Present the list to the user and ask which database they want to use
3. ONLY connect after user specifies the database name
4. Do NOT automatically connect to any database without user confirmation
5. Exception: If user explicitly mentions a database name in their query, connect directly
```

## Expected Behavior

### Scenario 1: User asks a query without specifying database
**User:** "Show me all customers"

**Agent:**
1. Calls `sqlcl_list_connections`
2. Shows: "I found these databases: insuranceapp_medium, salesdb_high. Which one would you like to use?"
3. Waits for user response
4. Connects only after user specifies

### Scenario 2: User specifies database in query
**User:** "Show me all customers from insuranceapp_medium"

**Agent:**
1. Recognizes database name in query
2. Connects directly to `insuranceapp_medium`
3. Executes the query

### Scenario 3: User explicitly asks to list databases
**User:** "What databases are available?"

**Agent:**
1. Calls `sqlcl_list_connections`
2. Shows the list
3. Waits for next instruction

## Testing

After restarting the server, test with:
```
User: "Show me all tables"
Expected: Agent lists databases and asks which one to use

User: "Connect to insuranceapp_medium and show tables"
Expected: Agent connects directly and shows tables
```

## Restart Required

Restart your development server for changes to take effect:
```bash
npm run dev
```
