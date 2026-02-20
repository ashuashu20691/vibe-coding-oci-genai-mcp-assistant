/**
 * Unit tests for ExportDropdown component
 * Task 10.6: Add export buttons to UI
 * Validates: Requirements 7.1, 7.3, 7.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ExportDropdown, ExportIcons, ExportFormat, ExportOption } from '@/components/ExportDropdown';

describe('Task 10.6: ExportDropdown Component', () => {
  const mockOnExport = vi.fn();
  
  const defaultOptions: ExportOption[] = [
    {
      format: 'png' as ExportFormat,
      label: 'Export as PNG',
      icon: ExportIcons.png,
      description: 'Download chart as image',
    },
    {
      format: 'csv' as ExportFormat,
      label: 'Export as CSV',
      icon: ExportIcons.csv,
      description: 'Download data as spreadsheet',
    },
  ];

  beforeEach(() => {
    mockOnExport.mockReset();
    mockOnExport.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Export Button Rendering', () => {
    it('should render export button with dropdown arrow', () => {
      render(<ExportDropdown options={defaultOptions} onExport={mockOnExport} />);
      
      const button = screen.getByTestId('export-dropdown-button');
      expect(button).toBeTruthy();
      expect(button.textContent).toContain('Export');
    });

    it('should have correct aria attributes', () => {
      render(<ExportDropdown options={defaultOptions} onExport={mockOnExport} />);
      
      const button = screen.getByTestId('export-dropdown-button');
      expect(button.getAttribute('aria-label')).toBe('Export options');
      expect(button.getAttribute('aria-haspopup')).toBe('true');
      expect(button.getAttribute('aria-expanded')).toBe('false');
    });

    it('should be disabled when disabled prop is true', () => {
      render(<ExportDropdown options={defaultOptions} onExport={mockOnExport} disabled />);
      
      const button = screen.getByTestId('export-dropdown-button') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });
  });

  describe('Dropdown Menu', () => {
    it('should open dropdown menu when button is clicked', () => {
      render(<ExportDropdown options={defaultOptions} onExport={mockOnExport} />);
      
      const button = screen.getByTestId('export-dropdown-button');
      fireEvent.click(button);
      
      const menu = screen.getByTestId('export-dropdown-menu');
      expect(menu).toBeTruthy();
    });

    it('should close dropdown menu when button is clicked again', () => {
      render(<ExportDropdown options={defaultOptions} onExport={mockOnExport} />);
      
      const button = screen.getByTestId('export-dropdown-button');
      fireEvent.click(button);
      expect(screen.getByTestId('export-dropdown-menu')).toBeTruthy();
      
      fireEvent.click(button);
      expect(screen.queryByTestId('export-dropdown-menu')).toBeFalsy();
    });

    it('should display all export options in dropdown', () => {
      render(<ExportDropdown options={defaultOptions} onExport={mockOnExport} />);
      
      const button = screen.getByTestId('export-dropdown-button');
      fireEvent.click(button);
      
      expect(screen.getByTestId('export-option-png')).toBeTruthy();
      expect(screen.getByTestId('export-option-csv')).toBeTruthy();
      expect(screen.getByText('Export as PNG')).toBeTruthy();
      expect(screen.getByText('Export as CSV')).toBeTruthy();
    });

    it('should display option descriptions', () => {
      render(<ExportDropdown options={defaultOptions} onExport={mockOnExport} />);
      
      const button = screen.getByTestId('export-dropdown-button');
      fireEvent.click(button);
      
      expect(screen.getByText('Download chart as image')).toBeTruthy();
      expect(screen.getByText('Download data as spreadsheet')).toBeTruthy();
    });

    it('should close dropdown when clicking outside', () => {
      render(
        <div>
          <ExportDropdown options={defaultOptions} onExport={mockOnExport} />
          <div data-testid="outside">Outside</div>
        </div>
      );
      
      const button = screen.getByTestId('export-dropdown-button');
      fireEvent.click(button);
      expect(screen.getByTestId('export-dropdown-menu')).toBeTruthy();
      
      fireEvent.mouseDown(screen.getByTestId('outside'));
      expect(screen.queryByTestId('export-dropdown-menu')).toBeFalsy();
    });
  });

  describe('Export Actions', () => {
    it('should call onExport with correct format when option is clicked', async () => {
      render(<ExportDropdown options={defaultOptions} onExport={mockOnExport} />);
      
      const button = screen.getByTestId('export-dropdown-button');
      fireEvent.click(button);
      
      const pngOption = screen.getByTestId('export-option-png');
      await act(async () => {
        fireEvent.click(pngOption);
      });
      
      expect(mockOnExport).toHaveBeenCalledWith('png');
    });

    it('should call onExport with csv format when CSV option is clicked', async () => {
      render(<ExportDropdown options={defaultOptions} onExport={mockOnExport} />);
      
      const button = screen.getByTestId('export-dropdown-button');
      fireEvent.click(button);
      
      const csvOption = screen.getByTestId('export-option-csv');
      await act(async () => {
        fireEvent.click(csvOption);
      });
      
      expect(mockOnExport).toHaveBeenCalledWith('csv');
    });

    it('should close dropdown after selecting an option', async () => {
      render(<ExportDropdown options={defaultOptions} onExport={mockOnExport} />);
      
      const button = screen.getByTestId('export-dropdown-button');
      fireEvent.click(button);
      
      const pngOption = screen.getByTestId('export-option-png');
      await act(async () => {
        fireEvent.click(pngOption);
      });
      
      // Dropdown should close immediately after clicking
      expect(screen.queryByTestId('export-dropdown-menu')).toBeFalsy();
    });
  });

  describe('Loading State (Requirement 7.6)', () => {
    it('should show loading spinner during export', async () => {
      // Create a promise that we can control
      let resolveExport: () => void;
      const exportPromise = new Promise<void>((resolve) => {
        resolveExport = resolve;
      });
      mockOnExport.mockReturnValue(exportPromise);

      render(<ExportDropdown options={defaultOptions} onExport={mockOnExport} />);
      
      const button = screen.getByTestId('export-dropdown-button');
      fireEvent.click(button);
      
      const pngOption = screen.getByTestId('export-option-png');
      
      // Start the export
      act(() => {
        fireEvent.click(pngOption);
      });
      
      // Should show loading spinner
      await waitFor(() => {
        expect(screen.getByTestId('export-loading-spinner')).toBeTruthy();
      });
      expect(screen.getByText('Exporting...')).toBeTruthy();
      
      // Resolve the export
      await act(async () => {
        resolveExport!();
      });
      
      // Should hide loading spinner after export completes
      await waitFor(() => {
        expect(screen.queryByTestId('export-loading-spinner')).toBeFalsy();
      });
    });

    it('should disable button during export', async () => {
      let resolveExport: () => void;
      const exportPromise = new Promise<void>((resolve) => {
        resolveExport = resolve;
      });
      mockOnExport.mockReturnValue(exportPromise);

      render(<ExportDropdown options={defaultOptions} onExport={mockOnExport} />);
      
      const button = screen.getByTestId('export-dropdown-button') as HTMLButtonElement;
      fireEvent.click(button);
      
      const pngOption = screen.getByTestId('export-option-png');
      
      act(() => {
        fireEvent.click(pngOption);
      });
      
      // Button should be disabled during export
      await waitFor(() => {
        expect(button.disabled).toBe(true);
      });
      
      // Resolve the export
      await act(async () => {
        resolveExport!();
      });
      
      // Button should be enabled after export completes
      await waitFor(() => {
        expect(button.disabled).toBe(false);
      });
    });

    it('should not open dropdown while exporting', async () => {
      let resolveExport: () => void;
      const exportPromise = new Promise<void>((resolve) => {
        resolveExport = resolve;
      });
      mockOnExport.mockReturnValue(exportPromise);

      render(<ExportDropdown options={defaultOptions} onExport={mockOnExport} />);
      
      const button = screen.getByTestId('export-dropdown-button');
      fireEvent.click(button);
      
      const pngOption = screen.getByTestId('export-option-png');
      
      act(() => {
        fireEvent.click(pngOption);
      });
      
      // Wait for loading state
      await waitFor(() => {
        expect(screen.getByTestId('export-loading-spinner')).toBeTruthy();
      });
      
      // Try to click button again - should not open dropdown
      fireEvent.click(button);
      expect(screen.queryByTestId('export-dropdown-menu')).toBeFalsy();
      
      // Cleanup
      await act(async () => {
        resolveExport!();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle export errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockOnExport.mockRejectedValue(new Error('Export failed'));

      render(<ExportDropdown options={defaultOptions} onExport={mockOnExport} />);
      
      const button = screen.getByTestId('export-dropdown-button') as HTMLButtonElement;
      fireEvent.click(button);
      
      const pngOption = screen.getByTestId('export-option-png');
      
      await act(async () => {
        fireEvent.click(pngOption);
      });
      
      // Should recover from error and re-enable button
      await waitFor(() => {
        expect(button.disabled).toBe(false);
      });
      
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe('Single Option', () => {
    it('should work with single export option', () => {
      const singleOption: ExportOption[] = [
        {
          format: 'csv' as ExportFormat,
          label: 'Export as CSV',
          icon: ExportIcons.csv,
        },
      ];

      render(<ExportDropdown options={singleOption} onExport={mockOnExport} />);
      
      const button = screen.getByTestId('export-dropdown-button');
      fireEvent.click(button);
      
      expect(screen.getByTestId('export-option-csv')).toBeTruthy();
      expect(screen.queryByTestId('export-option-png')).toBeFalsy();
    });
  });
});
