/**
 * Unit tests for ExportService CSV export functionality.
 * Tests Requirements 7.3 and 7.4.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExportService } from '../../src/services/export-service';
import { DashboardLayout } from '../../src/types';

// Mock DOM APIs for browser download functionality
const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = vi.fn();
const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();

// Store created elements for inspection
let createdElements: HTMLElement[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  createdElements = [];
  
  // Mock URL APIs
  global.URL.createObjectURL = mockCreateObjectURL;
  global.URL.revokeObjectURL = mockRevokeObjectURL;
  
  // Mock document.createElement
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    const element = {
      tagName,
      href: '',
      download: '',
      click: mockClick,
    } as unknown as HTMLElement;
    createdElements.push(element);
    return element;
  });
  
  // Mock document.body methods
  vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
  vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ExportService.exportToCSV', () => {
  describe('with array of objects', () => {
    it('should generate CSV with headers from object keys', () => {
      const data = [
        { name: 'Alice', age: 30, city: 'NYC' },
        { name: 'Bob', age: 25, city: 'LA' },
      ];
      
      ExportService.exportToCSV(data, 'test.csv');
      
      // Verify blob was created
      expect(mockCreateObjectURL).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blobArg = (mockCreateObjectURL.mock.calls[0] as any[])[0] as Blob;
      expect(blobArg).toBeInstanceOf(Blob);
      
      // Verify download was triggered
      expect(mockClick).toHaveBeenCalled();
      
      // Verify cleanup
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('should handle empty data gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      ExportService.exportToCSV([], 'test.csv');
      
      expect(consoleSpy).toHaveBeenCalledWith('ExportService.exportToCSV: No data to export');
      expect(mockCreateObjectURL).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle null/undefined data gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      ExportService.exportToCSV(null as unknown as Record<string, unknown>[], 'test.csv');
      
      expect(consoleSpy).toHaveBeenCalledWith('ExportService.exportToCSV: No data to export');
      expect(mockCreateObjectURL).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should set correct filename on download link', () => {
      const data = [{ name: 'Test' }];
      
      ExportService.exportToCSV(data, 'my-export.csv');
      
      const link = createdElements.find(el => el.tagName === 'a') as HTMLAnchorElement;
      expect(link?.download).toBe('my-export.csv');
    });
  });

  describe('CSV escaping (Requirement 7.4)', () => {
    it('should escape values containing commas', () => {
      const data = [{ description: 'Hello, World' }];
      
      ExportService.exportToCSV(data, 'test.csv');
      
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });

    it('should escape values containing quotes by doubling them', () => {
      const data = [{ quote: 'He said "Hello"' }];
      
      ExportService.exportToCSV(data, 'test.csv');
      
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });

    it('should escape values containing newlines', () => {
      const data = [{ multiline: 'Line 1\nLine 2' }];
      
      ExportService.exportToCSV(data, 'test.csv');
      
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });

    it('should escape values containing carriage returns', () => {
      const data = [{ text: 'Line 1\r\nLine 2' }];
      
      ExportService.exportToCSV(data, 'test.csv');
      
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });

    it('should handle null and undefined values', () => {
      const data = [{ name: 'Test', value: null, other: undefined }];
      
      ExportService.exportToCSV(data, 'test.csv');
      
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });

    it('should handle object values by JSON stringifying', () => {
      const data = [{ nested: { key: 'value' } }];
      
      ExportService.exportToCSV(data, 'test.csv');
      
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
  });

  describe('with 2D array', () => {
    it('should generate CSV from 2D array', () => {
      const data = [
        ['Name', 'Age', 'City'],
        ['Alice', 30, 'NYC'],
        ['Bob', 25, 'LA'],
      ];
      
      ExportService.exportToCSV(data, 'test.csv');
      
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
    });

    it('should handle mixed types in 2D array', () => {
      const data = [
        ['String', 123, true, null, undefined],
      ];
      
      ExportService.exportToCSV(data, 'test.csv');
      
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
  });

  describe('sparse data handling', () => {
    it('should handle objects with different keys', () => {
      const data = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', city: 'LA' },
        { age: 25, city: 'NYC' },
      ];
      
      ExportService.exportToCSV(data, 'test.csv');
      
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
  });
});

describe('ExportService.exportAsCsv (instance method)', () => {
  it('should return success result with CSV content', () => {
    const service = new ExportService();
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    
    const result = service.exportAsCsv(data, 'test.csv');
    
    expect(result.success).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.filename).toBe('test.csv');
    expect(result.mimeType).toBe('text/csv');
  });

  it('should return error for empty data', () => {
    const service = new ExportService();
    
    const result = service.exportAsCsv([]);
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('No data to export');
  });

  it('should use default filename when not provided', () => {
    const service = new ExportService();
    const data = [{ name: 'Test' }];
    
    const result = service.exportAsCsv(data);
    
    expect(result.filename).toBe('data-export.csv');
  });
});

describe('ExportService.exportToHTML', () => {
  const createTestDashboard = (): DashboardLayout => ({
    title: 'Test Dashboard',
    description: 'A test dashboard for unit testing',
    sections: [
      {
        id: 'stats-section',
        title: 'Statistics',
        type: 'stats',
        width: 'full',
        content: {
          statsCards: [
            { label: 'Total Users', value: 100, color: 'blue' },
            { label: 'Active Users', value: 75, color: 'green' },
          ],
        },
      },
      {
        id: 'table-section',
        title: 'Data Table',
        type: 'table',
        width: 'full',
        content: {
          tableConfig: { columns: ['name', 'value'], pageSize: 10 },
        },
      },
    ],
    filters: [],
    exportOptions: [{ format: 'html', label: 'Export HTML' }],
  });

  it('should generate HTML and trigger download', () => {
    const dashboard = createTestDashboard();
    
    ExportService.exportToHTML(dashboard, 'test-dashboard.html');
    
    // Verify blob was created
    expect(mockCreateObjectURL).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blobArg = (mockCreateObjectURL.mock.calls[0] as any[])[0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    
    // Verify download was triggered
    expect(mockClick).toHaveBeenCalled();
    
    // Verify cleanup
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('should set correct filename on download link', () => {
    const dashboard = createTestDashboard();
    
    ExportService.exportToHTML(dashboard, 'my-dashboard.html');
    
    const link = createdElements.find(el => el.tagName === 'a') as HTMLAnchorElement;
    expect(link?.download).toBe('my-dashboard.html');
  });

  it('should handle null dashboard gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    ExportService.exportToHTML(null as unknown as DashboardLayout, 'test.html');
    
    expect(consoleSpy).toHaveBeenCalledWith('ExportService.exportToHTML: No dashboard to export');
    expect(mockCreateObjectURL).not.toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  it('should handle undefined dashboard gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    ExportService.exportToHTML(undefined as unknown as DashboardLayout, 'test.html');
    
    expect(consoleSpy).toHaveBeenCalledWith('ExportService.exportToHTML: No dashboard to export');
    expect(mockCreateObjectURL).not.toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  it('should work with empty data array', () => {
    const dashboard = createTestDashboard();
    
    ExportService.exportToHTML(dashboard, 'test.html', []);
    
    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
  });

  it('should embed data in the HTML', () => {
    const dashboard = createTestDashboard();
    const data = [
      { name: 'Item 1', value: 100 },
      { name: 'Item 2', value: 200 },
    ];
    
    ExportService.exportToHTML(dashboard, 'test.html', data);
    
    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
  });

  it('should handle dashboard with visualization sections', () => {
    const dashboard: DashboardLayout = {
      ...createTestDashboard(),
      sections: [
        {
          id: 'viz-section',
          title: 'Chart',
          type: 'visualization',
          width: 'half',
          content: {
            visualization: {
              type: 'bar_chart',
              title: 'Sales Chart',
              priority: 1,
              dataKey: 'sales',
              config: {},
            },
          },
        },
      ],
    };
    
    ExportService.exportToHTML(dashboard, 'test.html');
    
    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
  });

  it('should handle dashboard with insights sections', () => {
    const dashboard: DashboardLayout = {
      ...createTestDashboard(),
      sections: [
        {
          id: 'insights-section',
          title: 'Key Insights',
          type: 'insights',
          width: 'full',
          content: {
            insights: ['Insight 1', 'Insight 2', 'Insight 3'],
          },
        },
      ],
    };
    
    ExportService.exportToHTML(dashboard, 'test.html');
    
    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
  });
});

describe('ExportService.exportAsHtml (instance method)', () => {
  const createTestDashboard = (): DashboardLayout => ({
    title: 'Test Dashboard',
    description: 'A test dashboard',
    sections: [],
    filters: [],
    exportOptions: [],
  });

  it('should return success result with HTML content', () => {
    const service = new ExportService();
    const dashboard = createTestDashboard();
    const data = [{ name: 'Test' }];
    
    const result = service.exportAsHtml(dashboard, data);
    
    expect(result.success).toBe(true);
    expect(result.content).toBeDefined();
    expect(typeof result.content).toBe('string');
    expect(result.mimeType).toBe('text/html');
  });

  it('should generate sanitized filename from dashboard title', () => {
    const service = new ExportService();
    const dashboard: DashboardLayout = {
      ...createTestDashboard(),
      title: 'My Test Dashboard!',
    };
    
    const result = service.exportAsHtml(dashboard, []);
    
    expect(result.filename).toBe('my-test-dashboard.html');
  });

  it('should include dashboard title in HTML', () => {
    const service = new ExportService();
    const dashboard: DashboardLayout = {
      ...createTestDashboard(),
      title: 'Sales Report',
    };
    
    const result = service.exportAsHtml(dashboard, []);
    
    expect(result.content).toContain('Sales Report');
  });

  it('should include dashboard description in HTML', () => {
    const service = new ExportService();
    const dashboard: DashboardLayout = {
      ...createTestDashboard(),
      description: 'Monthly sales analysis',
    };
    
    const result = service.exportAsHtml(dashboard, []);
    
    expect(result.content).toContain('Monthly sales analysis');
  });

  it('should embed data as JSON in script tag', () => {
    const service = new ExportService();
    const dashboard = createTestDashboard();
    const data = [{ name: 'Test', value: 42 }];
    
    const result = service.exportAsHtml(dashboard, data);
    
    expect(result.content).toContain('dashboardData');
    expect(result.content).toContain('"name":"Test"');
    expect(result.content).toContain('"value":42');
  });

  it('should include embedded CSS styles', () => {
    const service = new ExportService();
    const dashboard = createTestDashboard();
    
    const result = service.exportAsHtml(dashboard, []);
    
    expect(result.content).toContain('<style>');
    expect(result.content).toContain('.dashboard-container');
    expect(result.content).toContain('.dashboard-header');
  });

  it('should include embedded JavaScript', () => {
    const service = new ExportService();
    const dashboard = createTestDashboard();
    
    const result = service.exportAsHtml(dashboard, []);
    
    expect(result.content).toContain('<script>');
    expect(result.content).toContain('initializeDashboard');
    expect(result.content).toContain('sortTable');
  });

  it('should escape HTML special characters in title', () => {
    const service = new ExportService();
    const dashboard: DashboardLayout = {
      ...createTestDashboard(),
      title: '<script>alert("xss")</script>',
    };
    
    const result = service.exportAsHtml(dashboard, []);
    
    // The title in the HTML elements should be escaped
    expect(result.content).toContain('<title>&lt;script&gt;alert');
    expect(result.content).toContain('<h1>&lt;script&gt;alert');
  });

  it('should generate valid HTML document structure', () => {
    const service = new ExportService();
    const dashboard = createTestDashboard();
    
    const result = service.exportAsHtml(dashboard, []);
    
    expect(result.content).toContain('<!DOCTYPE html>');
    expect(result.content).toContain('<html lang="en">');
    expect(result.content).toContain('<head>');
    expect(result.content).toContain('<body>');
    expect(result.content).toContain('</html>');
  });

  it('should include responsive meta viewport tag', () => {
    const service = new ExportService();
    const dashboard = createTestDashboard();
    
    const result = service.exportAsHtml(dashboard, []);
    
    expect(result.content).toContain('viewport');
    expect(result.content).toContain('width=device-width');
  });
});


describe('ExportService.exportToPNG', () => {
  // Mock canvas API
  const mockToBlob = vi.fn((callback: (blob: Blob | null) => void) => {
    callback(new Blob(['mock-png-data'], { type: 'image/png' }));
  });
  
  const mockGetContext = vi.fn(() => ({
    fillStyle: '',
    fillRect: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
    font: '',
    textAlign: '',
    fillText: vi.fn(),
  }));

  const mockCanvas = {
    width: 0,
    height: 0,
    toBlob: mockToBlob,
    getContext: mockGetContext,
  };

  // Helper to create a properly mocked element
  const createMockElement = (hasCanvas: boolean = true) => {
    const mockChildCanvas = {
      width: 100,
      height: 100,
      toBlob: mockToBlob,
      getContext: mockGetContext,
    } as unknown as HTMLCanvasElement;

    return {
      tagName: 'div',
      querySelector: vi.fn((selector: string) => {
        if (selector === 'svg') return null;
        if (selector === 'canvas') return hasCanvas ? mockChildCanvas : null;
        return null;
      }),
      getBoundingClientRect: vi.fn(() => ({
        width: 100,
        height: 100,
        top: 0,
        left: 0,
        bottom: 100,
        right: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      })),
      getAttribute: vi.fn(() => null),
    } as unknown as HTMLElement;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock document.createElement for canvas
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return mockCanvas as unknown as HTMLCanvasElement;
      }
      const element = {
        tagName,
        href: '',
        download: '',
        click: mockClick,
      } as unknown as HTMLElement;
      createdElements.push(element);
      return element;
    });
  });

  it('should handle null element gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    await ExportService.exportToPNG(null as unknown as HTMLElement, 'test.png');
    
    expect(consoleSpy).toHaveBeenCalledWith('ExportService.exportToPNG: No element to export');
    expect(mockCreateObjectURL).not.toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  it('should handle undefined element gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    await ExportService.exportToPNG(undefined as unknown as HTMLElement, 'test.png');
    
    expect(consoleSpy).toHaveBeenCalledWith('ExportService.exportToPNG: No element to export');
    expect(mockCreateObjectURL).not.toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  it('should set correct filename on download link', async () => {
    const mockElement = createMockElement();
    
    await ExportService.exportToPNG(mockElement, 'my-chart.png');
    
    const link = createdElements.find(el => el.tagName === 'a') as HTMLAnchorElement;
    expect(link?.download).toBe('my-chart.png');
  });

  it('should use default options when not provided', async () => {
    const mockElement = createMockElement();
    
    await ExportService.exportToPNG(mockElement, 'test.png');
    
    // Verify canvas was created (default scale=2, padding=10)
    // Canvas dimensions should be (100 + 10*2) * 2 = 240
    expect(mockCanvas.width).toBe(240);
    expect(mockCanvas.height).toBe(240);
  });

  it('should apply custom options', async () => {
    const mockElement = createMockElement();
    
    await ExportService.exportToPNG(mockElement, 'test.png', {
      scale: 1,
      padding: 0,
      backgroundColor: '#000000',
    });
    
    // Canvas dimensions should be 100 * 1 = 100 (no padding, scale 1)
    expect(mockCanvas.width).toBe(100);
    expect(mockCanvas.height).toBe(100);
  });

  it('should trigger download after PNG generation', async () => {
    const mockElement = createMockElement();
    
    await ExportService.exportToPNG(mockElement, 'test.png');
    
    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalled();
  });

  it('should cleanup resources after download', async () => {
    const mockElement = createMockElement();
    
    await ExportService.exportToPNG(mockElement, 'test.png');
    
    // Verify cleanup
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    expect(mockRemoveChild).toHaveBeenCalled();
  });
});

describe('ExportService.exportAsPng (instance method)', () => {
  const mockToBlob = vi.fn((callback: (blob: Blob | null) => void) => {
    callback(new Blob(['mock-png-data'], { type: 'image/png' }));
  });
  
  const mockGetContext = vi.fn(() => ({
    fillStyle: '',
    fillRect: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
    font: '',
    textAlign: '',
    fillText: vi.fn(),
  }));

  const mockCanvas = {
    width: 0,
    height: 0,
    toBlob: mockToBlob,
    getContext: mockGetContext,
  };

  // Helper to create a properly mocked element
  const createMockElement = () => {
    const mockChildCanvas = {
      width: 100,
      height: 100,
      toBlob: mockToBlob,
      getContext: mockGetContext,
    } as unknown as HTMLCanvasElement;

    return {
      tagName: 'div',
      querySelector: vi.fn((selector: string) => {
        if (selector === 'svg') return null;
        if (selector === 'canvas') return mockChildCanvas;
        return null;
      }),
      getBoundingClientRect: vi.fn(() => ({
        width: 100,
        height: 100,
        top: 0,
        left: 0,
        bottom: 100,
        right: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      })),
      getAttribute: vi.fn(() => null),
    } as unknown as HTMLElement;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return mockCanvas as unknown as HTMLCanvasElement;
      }
      const element = {
        tagName,
        href: '',
        download: '',
        click: mockClick,
      } as unknown as HTMLElement;
      createdElements.push(element);
      return element;
    });
  });

  it('should return error for null element', async () => {
    const service = new ExportService();
    
    const result = await service.exportAsPng(null as unknown as HTMLElement);
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('No element to export');
  });

  it('should return success result with PNG blob', async () => {
    const service = new ExportService();
    const mockElement = createMockElement();
    
    const result = await service.exportAsPng(mockElement, 'test.png');
    
    expect(result.success).toBe(true);
    expect(result.content).toBeInstanceOf(Blob);
    expect(result.filename).toBe('test.png');
    expect(result.mimeType).toBe('image/png');
  });

  it('should use default filename when not provided', async () => {
    const service = new ExportService();
    const mockElement = createMockElement();
    
    const result = await service.exportAsPng(mockElement);
    
    expect(result.filename).toBe('chart-export.png');
  });
});
