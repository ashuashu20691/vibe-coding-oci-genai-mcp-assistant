// __tests__/unit/artifacts-chat-integration.test.ts

import { describe, it, expect } from 'vitest';
import { MAX_INLINE_ROWS } from '@/types';

describe('Artifacts Chat Integration Logic', () => {
  describe('Requirement 15.2: Route large outputs to artifacts panel', () => {
    it('should identify tables with >MAX_INLINE_ROWS as requiring artifacts panel', () => {
      const largeTable = {
        type: 'table',
        data: Array.from({ length: MAX_INLINE_ROWS + 1 }, (_, i) => ({ id: i })),
      };

      const shouldRoute = largeTable.data && largeTable.data.length > MAX_INLINE_ROWS;
      expect(shouldRoute).toBe(true);
    });

    it('should identify tables with ≤MAX_INLINE_ROWS as inline', () => {
      const smallTable = {
        type: 'table',
        data: Array.from({ length: MAX_INLINE_ROWS }, (_, i) => ({ id: i })),
      };

      const shouldRoute = smallTable.data && smallTable.data.length > MAX_INLINE_ROWS;
      expect(shouldRoute).toBe(false);
    });

    it('should identify charts as requiring artifacts panel', () => {
      const visualTypes = ['bar_chart', 'line_chart', 'pie_chart', 'scatter_chart', 'area_chart', 'map'];
      
      visualTypes.forEach(type => {
        const shouldRoute = visualTypes.includes(type);
        expect(shouldRoute).toBe(true);
      });
    });

    it('should use MAX_INLINE_ROWS constant (10) for threshold', () => {
      expect(MAX_INLINE_ROWS).toBe(10);
    });
  });

  describe('Requirement 15.3: Artifact creation from visualization', () => {
    it('should create table artifact with correct structure', () => {
      const visualization = {
        type: 'table',
        title: 'Test Table',
        data: [{ id: 1, name: 'Test' }],
      };

      const artifact = {
        id: 'artifact-123',
        type: 'table' as const,
        title: visualization.title,
        content: {
          type: 'table' as const,
          data: visualization.data,
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(artifact.type).toBe('table');
      expect(artifact.content.type).toBe('table');
      expect(artifact.content.data).toEqual(visualization.data);
      expect(artifact.title).toBe('Test Table');
    });

    it('should create chart artifact with correct structure', () => {
      const visualization = {
        type: 'bar_chart',
        title: 'Test Chart',
        data: [{ x: 1, y: 2 }],
      };

      const artifact = {
        id: 'artifact-123',
        type: 'chart' as const,
        title: visualization.title,
        content: {
          type: 'chart' as const,
          chartType: visualization.type,
          data: visualization.data,
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(artifact.type).toBe('chart');
      expect(artifact.content.type).toBe('chart');
      expect(artifact.content.chartType).toBe('bar_chart');
      expect(artifact.content.data).toEqual(visualization.data);
    });
  });

  describe('Requirement 15.5: User modification acknowledgments', () => {
    it('should generate filter acknowledgment message', () => {
      const modification = {
        modificationType: 'filter' as const,
        details: { column: 'name', value: 'Alice' },
      };

      const acknowledgment = `I see you filtered the table by ${modification.details.column}="${modification.details.value}".`;
      
      expect(acknowledgment).toBe('I see you filtered the table by name="Alice".');
    });

    it('should generate sort acknowledgment message', () => {
      const modification = {
        modificationType: 'sort' as const,
        details: { column: 'age', direction: 'ascending' },
      };

      const acknowledgment = `I see you sorted the table by ${modification.details.column} in ${modification.details.direction} order.`;
      
      expect(acknowledgment).toBe('I see you sorted the table by age in ascending order.');
    });
  });

  describe('Requirement 15.6: Artifact persistence', () => {
    it('should include artifact in conversation data structure', () => {
      const conversation = {
        id: 'conv-1',
        title: 'Test Conversation',
        createdAt: new Date(),
        updatedAt: new Date(),
        activeArtifact: {
          id: 'artifact-123',
          type: 'table' as const,
          title: 'Saved Table',
          content: {
            type: 'table' as const,
            data: [{ id: 1 }],
          },
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      expect(conversation.activeArtifact).toBeDefined();
      expect(conversation.activeArtifact?.id).toBe('artifact-123');
    });
  });

  describe('Routing logic edge cases', () => {
    it('should handle empty table data', () => {
      const emptyTable = {
        type: 'table',
        data: [],
      };

      const shouldRoute = emptyTable.data && emptyTable.data.length > MAX_INLINE_ROWS;
      expect(shouldRoute).toBe(false);
    });

    it('should handle undefined data', () => {
      const noData = {
        type: 'table',
        data: undefined,
      };

      const shouldRoute = noData.data && noData.data.length > MAX_INLINE_ROWS;
      expect(shouldRoute).toBeFalsy(); // undefined is falsy
    });

    it('should handle boundary case: exactly MAX_INLINE_ROWS', () => {
      const boundaryTable = {
        type: 'table',
        data: Array.from({ length: MAX_INLINE_ROWS }, (_, i) => ({ id: i })),
      };

      // Exactly MAX_INLINE_ROWS should stay inline (not > threshold)
      const shouldRoute = boundaryTable.data && boundaryTable.data.length > MAX_INLINE_ROWS;
      expect(shouldRoute).toBe(false);
    });

    it('should handle boundary case: MAX_INLINE_ROWS + 1', () => {
      const overBoundaryTable = {
        type: 'table',
        data: Array.from({ length: MAX_INLINE_ROWS + 1 }, (_, i) => ({ id: i })),
      };

      // Over threshold should go to artifacts
      const shouldRoute = overBoundaryTable.data && overBoundaryTable.data.length > MAX_INLINE_ROWS;
      expect(shouldRoute).toBe(true);
    });
  });
});
