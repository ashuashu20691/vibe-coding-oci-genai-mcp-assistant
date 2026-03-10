'use client';

import dynamic from 'next/dynamic';
import { ComponentProps } from 'react';
import type { ArtifactsPanel as ArtifactsPanelType } from './ArtifactsPanel';

// Lazy load the heavy ArtifactsPanel component
const ArtifactsPanelDynamic = dynamic(
  () => import('./ArtifactsPanel').then((mod) => ({ default: mod.ArtifactsPanel })),
  {
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading artifacts...</div>
      </div>
    ),
    ssr: false, // Don't render on server since it's heavy
  }
);

// Re-export with the same props interface
export function ArtifactsPanel(props: ComponentProps<typeof ArtifactsPanelType>) {
  return <ArtifactsPanelDynamic {...props} />;
}
