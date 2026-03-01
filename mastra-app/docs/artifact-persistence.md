# Artifact Persistence Across Conversation Turns

**Task:** 19.8 - Implement artifact persistence across turns  
**Validates:** Requirement 15.6 - Artifact persistence across turns

## Overview

Artifacts (tables, charts, dashboards, etc.) now persist across conversation turns. When a user creates an artifact in a conversation, it remains visible even after sending new messages, until it is explicitly cleared or replaced.

## Implementation

### 1. Data Model Changes

#### Conversation Type
Added `activeArtifact` field to the `Conversation` interface:

```typescript
export interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  modelId?: string;
  activeArtifact?: Artifact | null;
}
```

#### Database Schema
Added `active_artifact` column to the `conversations` table:

```sql
ALTER TABLE conversations ADD (
  active_artifact CLOB
);
```

### 2. Hook Changes

#### useArtifacts Hook
Updated to support persistence:

```typescript
export interface UseArtifactsReturn {
  artifact: Artifact | null;
  isOpen: boolean;
  setArtifact: (artifact: Artifact | null, conversationId?: string | null) => void;
  updateArtifact: (updates: Partial<Artifact>, conversationId?: string | null) => void;
  closePanel: () => void;
  onUserModification: (modification: Omit<ArtifactModification, 'timestamp'>) => void;
  restoreArtifact: (artifact: Artifact | null) => void;
}
```

**Key Changes:**
- `setArtifact` and `updateArtifact` now accept optional `conversationId` parameter
- When `conversationId` is provided, artifact is persisted to database
- New `restoreArtifact` method for loading artifacts when conversation is loaded

#### useConversation Hook
Updated to restore artifacts:

```typescript
interface UseConversationOptions {
  dbConnected?: boolean;
  onArtifactRestore?: (artifact: Artifact | null) => void;
}
```

**Key Changes:**
- New `onArtifactRestore` callback option
- When loading a conversation with an `activeArtifact`, the callback is invoked
- Parent component can use this to restore the artifact in the UI

### 3. API Endpoints

#### PUT /api/conversations/[id]/artifact
New endpoint for persisting artifacts:

```typescript
// Request body
{
  artifact: Artifact | null
}

// Response
{
  success: boolean
}
```

**Behavior:**
- Serializes artifact to JSON (handles Date objects)
- Stores in `active_artifact` column
- React components cannot be persisted (stored as placeholder)
- Setting `artifact: null` clears the artifact

#### GET /api/conversations/[id]
Updated to include artifact:

```typescript
// Response
{
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  modelId?: string;
  activeArtifact?: Artifact | null;
  messages: Message[];
}
```

### 4. Persistence Flow

#### Creating/Updating Artifact
```
User Action → setArtifact(artifact, conversationId)
           → persistArtifactToConversation(conversationId, artifact)
           → PUT /api/conversations/[id]/artifact
           → ConversationStore.updateConversationArtifact()
           → UPDATE conversations SET active_artifact = ...
```

#### Loading Conversation
```
User Selects Conversation → selectConversation(conversation)
                         → GET /api/conversations/[id]
                         → Returns conversation with activeArtifact
                         → onArtifactRestore(activeArtifact)
                         → restoreArtifact(activeArtifact)
                         → Artifact displayed in panel
```

## Usage Example

### In a Chat Component

```typescript
import { useArtifacts } from '@/hooks/useArtifacts';
import { useConversation } from '@/hooks/useConversation';

function ChatComponent() {
  const { 
    artifact, 
    setArtifact, 
    updateArtifact, 
    restoreArtifact 
  } = useArtifacts();
  
  const { 
    currentConversation, 
    selectConversation 
  } = useConversation({
    onArtifactRestore: (artifact) => {
      // Restore artifact when loading conversation
      restoreArtifact(artifact);
    }
  });

  const handleCreateArtifact = (newArtifact: Artifact) => {
    // Persist artifact to current conversation
    setArtifact(newArtifact, currentConversation?.id);
  };

  const handleUpdateArtifact = (updates: Partial<Artifact>) => {
    // Update and persist artifact
    updateArtifact(updates, currentConversation?.id);
  };

  const handleClearArtifact = () => {
    // Clear artifact from conversation
    setArtifact(null, currentConversation?.id);
  };

  return (
    <div>
      {/* Chat UI */}
      {artifact && (
        <ArtifactsPanel 
          artifact={artifact}
          onClose={handleClearArtifact}
        />
      )}
    </div>
  );
}
```

## Behavior

### Artifact Lifecycle

1. **Creation**: When agent generates output that should be displayed in artifacts panel (>10 rows, charts, etc.), artifact is created and persisted
2. **Persistence**: Artifact remains in conversation state across turns
3. **Updates**: When agent refines data, artifact version increments and changes are persisted
4. **Restoration**: When user loads conversation, artifact is restored and displayed
5. **Clearing**: Artifact is cleared only when:
   - User explicitly closes the panel and clears it
   - Agent creates a new artifact (replaces old one)
   - Conversation is deleted

### Serialization

**Supported Content Types:**
- `table`: Fully serialized
- `chart`: Fully serialized
- `code`: Fully serialized
- `html`: Fully serialized
- `dashboard`: Fully serialized
- `react_component`: Component reference lost, props preserved

**Date Handling:**
- `createdAt` and `updatedAt` serialized as ISO strings
- Deserialized back to Date objects when loaded

## Database Migration

To enable artifact persistence, run the migration:

```bash
sqlcl admin/password@connection_string @db/migrations/add_active_artifact_column.sql
```

Or manually execute:

```sql
ALTER TABLE conversations ADD (
  active_artifact CLOB
);
```

## Testing

Unit tests verify:
- Conversation type includes `activeArtifact` field
- Artifact serialization/deserialization
- Persistence behavior (set, update, clear)
- Restoration when loading conversation
- All artifact content types

Run tests:

```bash
npm test -- artifact-persistence.test.ts
```

## Limitations

1. **React Components**: Cannot be persisted. If an artifact contains a React component, it will be lost on reload. The component reference is replaced with a placeholder.

2. **Large Artifacts**: Very large artifacts (>4GB) may exceed CLOB limits. Consider implementing compression or external storage for extremely large datasets.

3. **Concurrent Updates**: If multiple users edit the same conversation simultaneously, last write wins. No conflict resolution is implemented.

## Future Enhancements

1. **Artifact History**: Track previous versions of artifacts
2. **Artifact Sharing**: Share artifacts across conversations
3. **Artifact Export**: Export artifacts independently of conversations
4. **Compression**: Compress large artifacts before storage
5. **External Storage**: Store very large artifacts in object storage (OCI Object Storage)
