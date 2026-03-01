// __tests__/unit/result-routing.test.ts

import { describe, it, expect } from 'vitest';
import { shouldRouteToArtifacts, detectResultSizeAndType } from '@/utils/result-routing';
import { MAX_INLINE_ROWS } from '@/types';

describe('Result Routing Logic - Task 24.4', () => {
  describe('shouldRouteToArtifacts', () => {
    describe('Requirement 15.2: Route large/visual results to artifacts panel', () => {
      it('should route tables with > MAX_INLINE_ROWS to artifacts panel', () => {
        const largeTable = {
          type: 'table',
          data: Array.from({ length: MAX_INLINE_ROWS + 1 }, (_, i) => ({ id: i })),
        };
        
        expect(shouldRouteToArtifacts(largeTable)).toBe(true);
      });
      
      it('should keep tables with ≤ MAX_INLINE_ROWS inline', () => {
        const smallTable = {
          type: 'table',
          data: Array.from({ length: MAX_INLINE_ROWS }, (_, i) => ({ id: i })),
        };
        
        expect(shouldRouteToArtifacts(smallTable)).toBe(false);
      });
      
      it('should route bar charts to artifacts panel', () => {
        const chart = {
          type: 'bar_chart',
          data: { labels: ['A', 'B'], values: [1, 2] },
        };
        
        expect(shouldRouteToArtifacts(chart)).toBe(true);
      });
      
      it('should route line charts to artifacts panel', () => {
        const chart = {
          type: 'line_chart',
          data: { labels: ['A', 'B'], values: [1, 2] },
        };
        
        expect(shouldRouteToArtifacts(chart)).toBe(true);
      });
      
      it('should route pie charts to artifacts panel', () => {
        const chart = {
          type: 'pie_chart',
          data: { labels: ['A', 'B'], values: [1, 2] },
        };
        
        expect(shouldRouteToArtifacts(chart)).toBe(true);
      });
      
      it('should route scatter charts to artifacts panel', () => {
        const chart = {
          type: 'scatter_chart',
          data: { points: [[1, 2], [3, 4]] },
        };
        
        expect(shouldRouteToArtifacts(chart)).toBe(true);
      });
      
      it('should route maps to artifacts panel', () => {
        const map = {
          type: 'map',
          data: { markers: [{ lat: 0, lng: 0 }] },
        };
        
        expect(shouldRouteToArtifacts(map)).toBe(true);
      });
      
      it('should route mermaid diagrams to artifacts panel', () => {
        const diagram = {
          type: 'mermaid',
          data: { code: 'graph TD; A-->B;' },
        };
        
        expect(shouldRouteToArtifacts(diagram)).toBe(true);
      });
      
      it('should route dashboards to artifacts panel', () => {
        const dashboard = {
          type: 'custom_dashboard',
          data: { widgets: [] },
        };
        
        expect(shouldRouteToArtifacts(dashboard)).toBe(true);
      });
    });
    
    describe('Requirement 18.7: Keep small/textual results inline', () => {
      it('should keep small tables inline (exactly MAX_INLINE_ROWS)', () => {
        const boundaryTable = {
          type: 'table',
          data: Array.from({ length: MAX_INLINE_ROWS }, (_, i) => ({ id: i })),
        };
        
        expect(shouldRouteToArtifacts(boundaryTable)).toBe(false);
      });
      
      it('should keep empty tables inline', () => {
        const emptyTable = {
          type: 'table',
          data: [],
        };
        
        expect(shouldRouteToArtifacts(emptyTable)).toBe(false);
      });
      
      it('should keep single-row tables inline', () => {
        const singleRow = {
          type: 'table',
          data: [{ id: 1, name: 'Test' }],
        };
        
        expect(shouldRouteToArtifacts(singleRow)).toBe(false);
      });
      
      it('should handle undefined visualization', () => {
        expect(shouldRouteToArtifacts(undefined)).toBe(false);
      });
      
      it('should handle null data in table', () => {
        const nullData = {
          type: 'table',
          data: null,
        };
        
        expect(shouldRouteToArtifacts(nullData as any)).toBe(false);
      });
    });
    
    describe('Edge cases', () => {
      it('should handle table with non-array data', () => {
        const invalidTable = {
          type: 'table',
          data: { rows: [] }, // Not an array
        };
        
        expect(shouldRouteToArtifacts(invalidTable as any)).toBe(false);
      });
      
      it('should handle unknown visualization types as inline', () => {
        const unknown = {
          type: 'unknown_type',
          data: { something: 'value' },
        };
        
        expect(shouldRouteToArtifacts(unknown as any)).toBe(false);
      });
      
      it('should route table with MAX_INLINE_ROWS + 1 to artifacts', () => {
        const overThreshold = {
          type: 'table',
          data: Array.from({ length: MAX_INLINE_ROWS + 1 }, (_, i) => ({ id: i })),
        };
        
        expect(shouldRouteToArtifacts(overThreshold)).toBe(true);
      });
    });
  });
  
  describe('detectResultSizeAndType', () => {
    it('should detect array data as tabular', () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = detectResultSizeAndType(data);
      
      expect(result.isTabular).toBe(true);
      expect(result.rowCount).toBe(3);
      expect(result.isVisual).toBe(false);
      expect(result.isTextual).toBe(false);
    });
    
    it('should detect chart types as visual', () => {
      const data = { type: 'bar_chart', data: {} };
      const result = detectResultSizeAndType(data);
      
      expect(result.isVisual).toBe(true);
      expect(result.isTabular).toBe(false);
      expect(result.isTextual).toBe(false);
    });
    
    it('should detect table type with row count', () => {
      const data = { 
        type: 'table', 
        data: [{ id: 1 }, { id: 2 }] 
      };
      const result = detectResultSizeAndType(data);
      
      expect(result.isTabular).toBe(true);
      expect(result.rowCount).toBe(2);
      expect(result.isVisual).toBe(false);
    });
    
    it('should detect string data as textual', () => {
      const data = 'Some text result';
      const result = detectResultSizeAndType(data);
      
      expect(result.isTextual).toBe(true);
      expect(result.isTabular).toBe(false);
      expect(result.isVisual).toBe(false);
      expect(result.rowCount).toBe(0);
    });
    
    it('should detect empty array as tabular with 0 rows', () => {
      const data: unknown[] = [];
      const result = detectResultSizeAndType(data);
      
      expect(result.isTabular).toBe(true);
      expect(result.rowCount).toBe(0);
    });
  });
  
  describe('MAX_INLINE_ROWS constant', () => {
    it('should be defined and equal to 10', () => {
      expect(MAX_INLINE_ROWS).toBe(10);
    });
    
    it('should be used as threshold for routing decisions', () => {
      // Test boundary conditions
      const atThreshold = {
        type: 'table',
        data: Array.from({ length: MAX_INLINE_ROWS }, (_, i) => ({ id: i })),
      };
      
      const overThreshold = {
        type: 'table',
        data: Array.from({ length: MAX_INLINE_ROWS + 1 }, (_, i) => ({ id: i })),
      };
      
      expect(shouldRouteToArtifacts(atThreshold)).toBe(false);
      expect(shouldRouteToArtifacts(overThreshold)).toBe(true);
    });
  });
});
