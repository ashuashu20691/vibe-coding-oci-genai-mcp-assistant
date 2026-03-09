# Data Generation Fix

## Problem
The agent was NOT generating synthetic data when asked to "create a sales dashboard" or similar requests. It would:
1. Connect to database
2. Check schema (sometimes twice)
3. Query for data
4. Find no data
5. Report "no results" and stop

The agent was NOT creating INSERT statements to populate tables with synthetic data.

## Root Cause
The agent instructions were TOO restrictive after the loop fix:
- "Maximum 3 tool calls per request" - not enough for data generation
- "If query returns no results: report it, do NOT check schema again" - prevented data generation
- No explicit instructions on HOW to generate data
- No examples of INSERT statements

## The Fix

### 1. Added Conversational Data Generation Workflow

**New workflow with user confirmation:**
```typescript
FOR DASHBOARDS (create dashboard, visualize):
1. Connect to database (if not connected)
2. Check schema ONCE if needed
3. Execute query to check if data exists
4. If no data: ASK "No data found in [TABLE]. Would you like me to generate synthetic data?"
5. If user says yes: generate and insert data, then query and visualize
6. If user says no: stop and report no data available
```

**Key principle: ALWAYS ask before generating data**

### 2. Updated Execution Rules with User Confirmation

**Before:**
- Maximum 3 tool calls per request
- If query returns no results: report it, do NOT check schema again

**After:**
- If query returns no results: ASK user "No data found. Would you like me to generate synthetic data?"
- Only generate data after user explicitly says "yes" or "generate data"
- Maximum 5-6 tool calls for complex workflows (connect, schema, multiple INSERTs, query)
- Execute multiple SQL statements if needed (INSERTs, then SELECT)

### 3. Added Explicit Examples with User Confirmation

New section with conversational flow:
```typescript
<data_generation_examples>
When user asks to "create a sales dashboard":

1. Connect and check schema
2. Query: SELECT * FROM SALES
3. If no results: RESPOND "No data found in SALES table. Would you like me to generate synthetic sales data for testing?"
4. WAIT for user response
5. If user says "yes" or "generate data":
   - Generate INSERT statements with realistic data
   - Execute each INSERT using run-sql
   - Query the data
   - Present results for visualization
6. If user says "no": STOP and report no data available

CRITICAL: Never generate data without asking first. Always get user confirmation.
</data_generation_examples>
```

### 4. Increased maxSteps

**In chat/route.ts:**
- Changed from `maxSteps: 5` to `maxSteps: 8`
- Allows for: connect, schema check, multiple INSERT statements, final query

## Expected Behavior After Fix

### Scenario: "Create a sales dashboard"

**Before fix:**
1. Connect to database
2. Check schema
3. Query SALES table → no results
4. Report "No data found"
5. STOP ❌

**After fix (with user confirmation):**
1. Connect to database
2. Check schema (see SALES table structure)
3. Query SALES table → no results
4. **ASK: "No data found in SALES table. Would you like me to generate synthetic sales data for testing?"**
5. **WAIT for user response**
6. If user says "yes":
   - Generate 10-20 INSERT statements with realistic sales data
   - Execute each INSERT using run-sql
   - Query SALES table → returns generated data
   - Present data for visualization ✅
7. If user says "no":
   - Report "No data available" and STOP ✅

### Scenario: "Generate customer data"

**After fix (explicit request):**
1. User says "Generate customer data" (explicit request)
2. Connect to database
3. Check schema (see CUSTOMERS table structure)
4. Generate INSERT statements:
   ```sql
   INSERT INTO CUSTOMERS VALUES (1, 'John Doe', 'john@example.com', '555-0100');
   INSERT INTO CUSTOMERS VALUES (2, 'Jane Smith', 'jane@example.com', '555-0101');
   ...
   ```
5. Execute INSERTs
6. Query to confirm: SELECT * FROM CUSTOMERS
7. Present results ✅

**Note:** When user explicitly says "generate data", no confirmation needed.

## Key Changes Summary

| Aspect | Before | After |
|--------|--------|-------|
| Max tool calls | 3 | 5-6 |
| Data generation | Not supported | Supported with user confirmation |
| Empty results | Report and stop | Ask user if they want synthetic data |
| User confirmation | Not required | **REQUIRED before generating data** |
| INSERT statements | Not mentioned | Explicitly encouraged with examples |
| maxSteps | 5 | 8 |

## Testing

To verify the fix works:

1. **Test conversational data generation:**
   ```
   User: "Create a sales dashboard"
   Agent: Connects, queries, finds no data
   Agent: "No data found in SALES table. Would you like me to generate synthetic sales data for testing?"
   User: "Yes"
   Agent: Generates INSERTs, populates table, queries data, presents results
   ```

2. **Test user declining:**
   ```
   User: "Show me customer data"
   Agent: Connects, queries, finds no data
   Agent: "No data found. Would you like me to generate synthetic data?"
   User: "No"
   Agent: "No data available" and stops
   ```

3. **Test with existing data:**
   ```
   User: "Show me sales data"
   Agent: Queries existing data, no confirmation needed, presents results
   ```

4. **Test explicit generation:**
   ```
   User: "Generate 20 customer records"
   Agent: Creates 20 INSERT statements, executes them, confirms creation (no asking needed - explicit request)
   ```

## Balance Achieved

The fix maintains the loop prevention while enabling conversational data generation:

✅ Still prevents infinite schema checking loops
✅ Still limits total steps (8 max)
✅ Still prevents repeated tool calls
✅ NOW asks user before generating data (respectful UX)
✅ NOW supports data generation workflows with confirmation
✅ NOW handles dashboard requests properly
✅ User has control over data generation

## Files Modified

1. `src/mastra/agents/database-agent.ts`
   - Added data generation workflow
   - Added explicit examples
   - Updated execution rules
   - Increased max tool calls to 5-6

2. `src/app/api/chat/route.ts`
   - Increased maxSteps from 5 to 8
   - Allows for data generation workflows

## Impact

- Enables full dashboard creation workflows
- Supports synthetic data generation
- Maintains loop prevention
- Provides clear examples for the agent to follow
- Balances autonomy with constraints
