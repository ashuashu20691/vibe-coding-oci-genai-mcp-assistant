'use client';

import dynamic from 'next/dynamic';
import { ComponentProps } from 'react';
import type { Chart as ChartType } from './Chart';

// Lazy load the Chart component (includes recharts)
const ChartDynamic = dynamic(
  () => import('./Chart').then((mod) => ({ default: mod.Chart })),
  {
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading chart...</div>
      </div>
    ),
    ssr: false,
  }
);

export function Chart(props: ComponentProps<typeof ChartType>) {
  return <ChartDynamic {...props} />;
}
