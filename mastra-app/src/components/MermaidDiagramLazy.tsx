'use client';

import dynamic from 'next/dynamic';
import { ComponentProps } from 'react';
import type { MermaidDiagram as MermaidDiagramType } from './MermaidDiagram';

// Lazy load the MermaidDiagram component (includes mermaid library)
const MermaidDiagramDynamic = dynamic(
  () => import('./MermaidDiagram').then((mod) => ({ default: mod.MermaidDiagram })),
  {
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading diagram...</div>
      </div>
    ),
    ssr: false,
  }
);

export function MermaidDiagram(props: ComponentProps<typeof MermaidDiagramType>) {
  return <MermaidDiagramDynamic {...props} />;
}
