# Bundle Size Optimization Guide

This document describes the bundle size optimizations implemented for the Vercel UI Adoption project.

## Target

- **Initial bundle size**: < 200KB gzipped
- **Performance**: Time to Interactive < 2s on 3G

## Optimizations Implemented

### 1. Next.js Configuration (`next.config.ts`)

#### Code Splitting
- Configured webpack to split chunks by library type:
  - `framework`: React core (react, react-dom, scheduler)
  - `ai-elements`: AI SDK libraries (@ai-sdk/*, ai)
  - `radix-ui`: Radix UI components (shadcn/ui base)
  - `charts`: Heavy visualization libraries (recharts, d3, mermaid)
  - `lib`: Other vendor libraries
  - `commons`: Shared application code

#### Tree-Shaking
- Enabled `usedExports` and `sideEffects: false` for aggressive tree-shaking
- Configured `optimizePackageImports` for automatic optimization of:
  - Radix UI components
  - lucide-react icons
  - recharts

#### Production Optimizations
- Enabled SWC minification
- Disabled source maps in production
- Optimized image formats (AVIF, WebP)

### 2. Lazy Loading

#### Heavy Components
Created lazy-loaded wrappers for components with large dependencies:

- **ArtifactsPanelLazy.tsx**: Lazy loads the artifacts panel
  - Includes chart rendering, table controls, code highlighting
  - Only loaded when artifacts are displayed
  
- **ChartLazy.tsx**: Lazy loads chart components
  - Includes recharts library (~100KB)
  - Only loaded when charts are rendered
  
- **MermaidDiagramLazy.tsx**: Lazy loads Mermaid diagrams
  - Includes mermaid library (~200KB)
  - Only loaded when diagrams are displayed

#### Benefits
- Reduces initial bundle size by ~300KB
- Improves Time to Interactive
- Better caching (heavy components in separate chunks)

### 3. Optimized Imports (`lib/optimized-imports.ts`)

#### Icon Tree-Shaking
- Explicitly imports only used icons from lucide-react
- Prevents bundling entire icon library (~500KB)
- Current usage: ~50 icons (~10KB)

#### Radix UI Optimization
- Centralized imports for Radix UI primitives
- Ensures consistent tree-shaking across the app

### 4. Component Index Optimization

Updated `components/index.ts` to:
- Export lazy-loaded versions of heavy components
- Maintain type exports for TypeScript
- Preserve backward compatibility

## Usage

### Building and Analyzing

```bash
# Build the application
npm run build

# Analyze bundle sizes
npm run analyze

# Build and analyze in one command
npm run build:analyze
```

### Bundle Analysis Output

The `analyze-bundle.js` script provides:
- Top 10 largest chunks by gzipped size
- Total initial bundle size
- Comparison against 200KB target
- Optimization suggestions if target is exceeded

### Example Output

```
📦 Chunk Sizes (Top 10):

Name                                              Size            Gzipped
--------------------------------------------------------------------------------
framework-abc123.js                               150.5 KB        45.2 KB
ai-elements-def456.js                             120.3 KB        38.1 KB
radix-ui-ghi789.js                                95.7 KB         28.4 KB
...

📊 Initial Bundle Size: 185.3 KB gzipped
🎯 Target: < 200 KB gzipped

✅ Bundle size is within target! (14.7 KB under)
```

## Lazy Loading Components

### Using Lazy-Loaded Components

The lazy-loaded components are drop-in replacements:

```tsx
// Before
import { ArtifactsPanel } from '@/components';

// After (automatic via index.ts)
import { ArtifactsPanel } from '@/components';
// Now uses ArtifactsPanelLazy automatically
```

### Creating New Lazy Components

To lazy load a new heavy component:

```tsx
'use client';

import dynamic from 'next/dynamic';
import { ComponentProps } from 'react';
import type { HeavyComponent as HeavyComponentType } from './HeavyComponent';

const HeavyComponentDynamic = dynamic(
  () => import('./HeavyComponent').then((mod) => ({ default: mod.HeavyComponent })),
  {
    loading: () => <div>Loading...</div>,
    ssr: false, // Disable SSR for heavy components
  }
);

export function HeavyComponent(props: ComponentProps<typeof HeavyComponentType>) {
  return <HeavyComponentDynamic {...props} />;
}
```

## Route-Based Code Splitting

Next.js automatically code-splits by route. To optimize further:

### Dynamic Imports in Pages

```tsx
// app/dashboard/page.tsx
import dynamic from 'next/dynamic';

const DashboardChart = dynamic(() => import('@/components/DashboardChart'), {
  loading: () => <ChartSkeleton />,
});

export default function DashboardPage() {
  return <DashboardChart data={data} />;
}
```

### Conditional Loading

```tsx
// Only load when needed
const [showChart, setShowChart] = useState(false);

const Chart = useMemo(
  () => dynamic(() => import('@/components/Chart')),
  []
);

return (
  <>
    <button onClick={() => setShowChart(true)}>Show Chart</button>
    {showChart && <Chart data={data} />}
  </>
);
```

## Monitoring Bundle Size

### CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/bundle-size.yml
- name: Build and analyze bundle
  run: npm run build:analyze
  
- name: Check bundle size
  run: |
    if [ $? -ne 0 ]; then
      echo "Bundle size exceeds target!"
      exit 1
    fi
```

### Bundle Size Budgets

Configure in `next.config.ts`:

```typescript
experimental: {
  bundlePagesRouterDependencies: true,
  optimizePackageImports: [...],
}
```

## Best Practices

### 1. Import Only What You Need

```tsx
// ❌ Bad - imports entire library
import * as Icons from 'lucide-react';

// ✅ Good - imports specific icons
import { Send, Paperclip } from 'lucide-react';
```

### 2. Use Dynamic Imports for Heavy Features

```tsx
// ❌ Bad - always loaded
import { MermaidDiagram } from '@/components';

// ✅ Good - loaded on demand
const MermaidDiagram = dynamic(() => import('@/components/MermaidDiagram'));
```

### 3. Avoid Barrel Exports for Large Libraries

```tsx
// ❌ Bad - may bundle entire library
export * from 'recharts';

// ✅ Good - explicit exports
export { LineChart, BarChart } from 'recharts';
```

### 4. Use Tree-Shakeable Libraries

Prefer libraries that support tree-shaking:
- ✅ lodash-es (tree-shakeable)
- ❌ lodash (not tree-shakeable)

### 5. Analyze Dependencies

```bash
# Check what's in your bundle
npx next build --profile
```

## Troubleshooting

### Bundle Size Still Too Large

1. **Check for duplicate dependencies**
   ```bash
   npm ls <package-name>
   ```

2. **Analyze what's in the bundle**
   ```bash
   npm install -D @next/bundle-analyzer
   ```
   
   Add to `next.config.ts`:
   ```typescript
   const withBundleAnalyzer = require('@next/bundle-analyzer')({
     enabled: process.env.ANALYZE === 'true',
   });
   
   module.exports = withBundleAnalyzer(nextConfig);
   ```
   
   Run:
   ```bash
   ANALYZE=true npm run build
   ```

3. **Check for large dependencies**
   ```bash
   npx webpack-bundle-analyzer .next/analyze/client.json
   ```

### Lazy Loading Not Working

1. **Ensure 'use client' directive**
   ```tsx
   'use client'; // Must be at top of file
   ```

2. **Check dynamic import syntax**
   ```tsx
   // ✅ Correct
   dynamic(() => import('./Component'))
   
   // ❌ Incorrect
   dynamic(import('./Component'))
   ```

3. **Verify SSR is disabled for heavy components**
   ```tsx
   dynamic(() => import('./Component'), { ssr: false })
   ```

## Performance Metrics

After optimization, you should see:

- **Initial bundle**: < 200KB gzipped ✅
- **Time to Interactive**: < 2s on 3G ✅
- **First Contentful Paint**: < 1s ✅
- **Lighthouse Performance**: > 90 ✅

## Related Files

- `next.config.ts` - Webpack and Next.js configuration
- `src/components/index.ts` - Component exports with lazy loading
- `src/lib/optimized-imports.ts` - Tree-shakeable imports
- `scripts/analyze-bundle.js` - Bundle analysis script
- `src/components/*Lazy.tsx` - Lazy-loaded component wrappers

## References

- [Next.js Bundle Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/bundle-analyzer)
- [React Dynamic Imports](https://react.dev/reference/react/lazy)
- [Webpack Tree Shaking](https://webpack.js.org/guides/tree-shaking/)
- [Web.dev Performance](https://web.dev/performance/)
