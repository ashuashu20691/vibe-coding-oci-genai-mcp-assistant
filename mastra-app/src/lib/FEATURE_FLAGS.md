# Feature Flag System

This directory contains the feature flag system for the Vercel AI SDK UI/UX adoption migration.

## Overview

The feature flag system allows for progressive migration from legacy components to AI Elements components with safe rollback capability. It provides:

- **Runtime component selection** based on environment variables
- **Error boundaries** with automatic fallback to legacy components
- **Component registry** for centralized component mapping
- **Granular control** over individual feature adoption

## Usage

### Environment Variable

Set the feature flag in `.env`:

```bash
# Enable AI Elements components
NEXT_PUBLIC_USE_AI_ELEMENTS=true

# Disable AI Elements components (use legacy)
NEXT_PUBLIC_USE_AI_ELEMENTS=false
```

### Feature Flag Functions

```typescript
import { featureFlags, useAIElements } from '@/lib/feature-flags';

// Check if AI Elements is enabled globally
const enabled = useAIElements();

// Check specific features
const useNewMessages = featureFlags.aiElementsMessages();
const useNewTools = featureFlags.aiElementsTools();
const useNewInput = featureFlags.aiElementsInput();
```

### Component Selection

#### Method 1: Direct Selection

```typescript
import { selectComponent } from '@/lib/component-mapper';
import { featureFlags } from '@/lib/feature-flags';
import LegacyMessage from './legacy/Message';
import AIElementsMessage from './ai-elements/Message';

const Message = selectComponent(
  { legacy: LegacyMessage, aiElements: AIElementsMessage },
  featureFlags.aiElementsMessages
);

export default Message;
```

#### Method 2: Higher-Order Component

```typescript
import { withFeatureFlag } from '@/lib/component-mapper';
import { featureFlags } from '@/lib/feature-flags';
import LegacyMessage from './legacy/Message';
import AIElementsMessage from './ai-elements/Message';

const Message = withFeatureFlag(
  LegacyMessage,
  AIElementsMessage,
  featureFlags.aiElementsMessages
);

export default Message;
```

#### Method 3: Safe Component (with Error Boundary)

```typescript
import { safeComponent } from '@/lib/component-mapper';
import { featureFlags } from '@/lib/feature-flags';
import LegacyMessage from './legacy/Message';
import AIElementsMessage from './ai-elements/Message';

const Message = safeComponent(
  AIElementsMessage,
  LegacyMessage,
  featureFlags.aiElementsMessages
);

export default Message;
```

### Component Registry

Register components for centralized management:

```typescript
import { registerComponent, getComponent } from '@/lib/component-mapper';
import LegacyMessage from './legacy/Message';
import AIElementsMessage from './ai-elements/Message';

// Register component
registerComponent('AssistantMessage', {
  legacy: LegacyMessage,
  aiElements: AIElementsMessage,
});

// Get component from registry
const Message = getComponent('AssistantMessage', featureFlags.aiElementsMessages);
```

## Available Feature Flags

| Flag | Description | Default |
|------|-------------|---------|
| `aiElementsMessages` | Enable AI Elements message components | `false` |
| `aiElementsTools` | Enable AI Elements tool display components | `false` |
| `aiElementsInput` | Enable AI Elements input with file upload | `false` |
| `enhancedSidebar` | Enable enhanced sidebar with shadcn/ui | `false` |
| `commandPalette` | Enable command palette (Cmd+K) | `false` |
| `enhancedArtifacts` | Enable enhanced artifacts panel | `false` |

## Error Handling

The system includes automatic error handling:

1. **Component Selection Errors**: Falls back to legacy component
2. **Render Errors**: Error boundary catches and falls back to legacy
3. **Console Logging**: All errors are logged for debugging

## Debugging

Enable feature flag logging in development:

```typescript
import { logFeatureFlags, getFeatureFlagStates } from '@/lib/feature-flags';

// Log all feature flag states
logFeatureFlags();

// Get feature flag states programmatically
const states = getFeatureFlagStates();
console.log(states);
```

## Rollback Procedure

### Immediate Rollback (< 1 hour)

1. Set environment variable:
   ```bash
   NEXT_PUBLIC_USE_AI_ELEMENTS=false
   ```

2. Restart the application:
   ```bash
   npm run build
   npm start
   ```

### Partial Rollback

Modify individual feature flags in `feature-flags.ts`:

```typescript
export const featureFlags = {
  aiElementsMessages: () => false, // Disable messages
  aiElementsTools: () => useAIElements(), // Keep tools enabled
  // ...
};
```

### Full Rollback

Revert Git commits:

```bash
git revert <commit-hash>
git push
```

## Best Practices

1. **Always use error boundaries** for AI Elements components
2. **Test both modes** (enabled/disabled) before deployment
3. **Monitor error logs** after enabling new features
4. **Keep legacy components** until migration is fully validated
5. **Document component mappings** in the registry

## Migration Checklist

- [ ] Install dependencies (ai, @ai-sdk/react, shadcn/ui)
- [ ] Configure feature flag in .env
- [ ] Create AI Elements wrapper components
- [ ] Register components in component registry
- [ ] Add error boundaries
- [ ] Test with flag enabled
- [ ] Test with flag disabled
- [ ] Monitor production errors
- [ ] Remove legacy components (after validation)

## Support

For issues or questions about the feature flag system:

1. Check console logs for error messages
2. Verify environment variable is set correctly
3. Test with feature flag disabled to isolate issues
4. Review component registry for missing mappings
