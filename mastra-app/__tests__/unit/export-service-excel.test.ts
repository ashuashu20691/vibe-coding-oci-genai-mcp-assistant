// __tests__/unit/export-service-excel.test.ts

import { describe, it, expect } from 'vitest';
import { ExportService, ExcelExportData } from '@/services/export-service';

describe('ExportService - Excel Export', () => {
  describe('Excel export with multi-modal content', () => {
    it('should generate Excel workbook with basic data', async () => {
      const exportData: ExcelExportData = {
        sheetName: 'Test Data',
        headers: ['Name', 'Age', 'Grade'],
        rows: [
          ['Alice', 25, 'A'],
          ['Bob', 30, 'B'],
          ['Charlie', 35, 'C'],
        ],
      };

      const service = new (ExportService as any)();
      const buffer = await service.generateExcelWorkbook(exportData, {});

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should handle multiple sheets', async () => {
      const exportData: ExcelExportData[] = [
        {
          sheetName: 'Sheet 1',
          headers: ['Col1', 'Col2'],
          rows: [['A', 'B']],
        },
        {
          sheetName: 'Sheet 2',
          headers: ['Col3', 'Col4'],
          rows: [['C', 'D']],
        },
      ];

      const service = new (ExportService as any)();
      const buffer = await service.generateExcelWorkbook(exportData, {});

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should apply header formatting when enabled', async () => {
      const exportData: ExcelExportData = {
        sheetName: 'Formatted',
        headers: ['Header1', 'Header2'],
        rows: [['Value1', 'Value2']],
      };

      const service = new (ExportService as any)();
      const buffer = await service.generateExcelWorkbook(exportData, {
        formatHeaders: true,
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should handle conditional formatting rules', async () => {
      const exportData: ExcelExportData = {
        sheetName: 'Grades',
        headers: ['Student', 'Grade'],
        rows: [
          ['Alice', 'A'],
          ['Bob', 'B'],
          ['Charlie', 'C'],
          ['David', 'D'],
        ],
        conditionalFormatting: [
          {
            column: 1,
            type: 'grade',
            gradeColors: {
              A: '92D050',
              B: '92D050',
              C: 'FFFF00',
              D: 'FF0000',
            },
          },
        ],
      };

      const service = new (ExportService as any)();
      const buffer = await service.generateExcelWorkbook(exportData, {
        applyConditionalFormatting: true,
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should handle image embedding', async () => {
      // Create a simple 1x1 PNG image as base64
      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const exportData: ExcelExportData = {
        sheetName: 'Images',
        headers: ['Name', 'Image'],
        rows: [['Test', '']],
        images: [
          {
            imageData: pngBase64,
            row: 0,
            column: 1,
            width: 50,
            height: 50,
            extension: 'png',
          },
        ],
      };

      const service = new (ExportService as any)();
      const buffer = await service.generateExcelWorkbook(exportData, {});

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should handle chart placeholders', async () => {
      const exportData: ExcelExportData = {
        sheetName: 'Charts',
        headers: ['Month', 'Sales'],
        rows: [
          ['Jan', 100],
          ['Feb', 150],
        ],
        charts: [
          {
            type: 'bar',
            title: 'Monthly Sales',
            dataRange: 'A1:B3',
            position: { row: 5, column: 0 },
          },
        ],
      };

      const service = new (ExportService as any)();
      const buffer = await service.generateExcelWorkbook(exportData, {});

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should auto-size columns when enabled', async () => {
      const exportData: ExcelExportData = {
        sheetName: 'AutoSize',
        headers: ['Short', 'Very Long Header Name'],
        rows: [
          ['A', 'Short value'],
          ['B', 'This is a much longer value that should affect column width'],
        ],
      };

      const service = new (ExportService as any)();
      const buffer = await service.generateExcelWorkbook(exportData, {
        autoSizeColumns: true,
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should handle empty data gracefully', async () => {
      const exportData: ExcelExportData = {
        sheetName: 'Empty',
        headers: [],
        rows: [],
      };

      const service = new (ExportService as any)();
      const buffer = await service.generateExcelWorkbook(exportData, {});

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should convert column index to Excel letter correctly', () => {
      const service = new (ExportService as any)();
      
      expect(service.getColumnLetter(0)).toBe('A');
      expect(service.getColumnLetter(1)).toBe('B');
      expect(service.getColumnLetter(25)).toBe('Z');
      expect(service.getColumnLetter(26)).toBe('AA');
      expect(service.getColumnLetter(27)).toBe('AB');
    });
  });
});
