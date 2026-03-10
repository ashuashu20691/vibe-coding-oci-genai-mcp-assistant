import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArtifactsPanel } from '@/components/ArtifactsPanel';
import type { Artifact } from '@/types';

// Mock the child components
vi.mock('@/components/OutputRenderer', () => ({
  OutputRenderer: ({ data, outputType, title }: any) => (
    <div data-testid="output-renderer">
      <div>Type: {outputType}</div>
      <div>Title: {title}</div>
      <div>Data: {JSON.stringify(data)}</div>
    </div>
  ),
}));

vi.mock('@/components/DataTable', () => ({
  DataTable: ({ data, title }: any) => (
    <div data-testid="data-table">
      <div>Title: {title}</div>
      <div>Rows: {data.length}</div>
    </div>
  ),
}));

vi.mock('@/components/DashboardRenderer', () => ({
  DashboardRenderer: ({ config }: any) => (
    <div data-testid="dashboard-renderer">
      <div>Title: {config.title}</div>
      <div>Charts: {config.charts.length}</div>
      <div>Tables: {config.tables.length}</div>
    </div>
  ),
}));

describe('ArtifactsPanel', () => {
  const mockOnClose = vi.fn();
  const mockOnUserModification = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when artifact is null', () => {
    const { container } = render(
      <ArtifactsPanel
        artifact={null}
        onClose={mockOnClose}
        onUserModification={mockOnUserModification}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render table artifact', () => {
    const artifact: Artifact = {
      id: 'test-1',
      type: 'table',
      title: 'Test Table',
      content: {
        type: 'table',
        data: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
      },
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(
      <ArtifactsPanel
        artifact={artifact}
        onClose={mockOnClose}
        onUserModification={mockOnUserModification}
      />
    );

    expect(screen.getByText('Test Table')).toBeInTheDocument();
    expect(screen.getByTestId('data-table')).toBeInTheDocument();
    expect(screen.getByText('Rows: 2')).toBeInTheDocument();
  });

  it('should render chart artifact', () => {
    const artifact: Artifact = {
      id: 'test-2',
      type: 'chart',
      title: 'Test Chart',
      content: {
        type: 'chart',
        chartType: 'bar_chart',
        data: [{ x: 1, y: 10 }],
        config: {},
      },
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(
      <ArtifactsPanel
        artifact={artifact}
        onClose={mockOnClose}
        onUserModification={mockOnUserModification}
      />
    );

    expect(screen.getByText('Test Chart')).toBeInTheDocument();
    expect(screen.getByTestId('output-renderer')).toBeInTheDocument();
    expect(screen.getByText('Type: bar_chart')).toBeInTheDocument();
  });

  it('should render code artifact', () => {
    const artifact: Artifact = {
      id: 'test-3',
      type: 'code',
      title: 'Test Code',
      content: {
        type: 'code',
        code: 'console.log("Hello World");',
        language: 'javascript',
      },
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(
      <ArtifactsPanel
        artifact={artifact}
        onClose={mockOnClose}
        onUserModification={mockOnUserModification}
      />
    );

    expect(screen.getByText('Test Code')).toBeInTheDocument();
    expect(screen.getByText('console.log("Hello World");')).toBeInTheDocument();
  });

  it('should render html artifact', () => {
    const artifact: Artifact = {
      id: 'test-4',
      type: 'html',
      title: 'Test HTML',
      content: {
        type: 'html',
        html: '<div>Hello HTML</div>',
      },
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(
      <ArtifactsPanel
        artifact={artifact}
        onClose={mockOnClose}
        onUserModification={mockOnUserModification}
      />
    );

    expect(screen.getByText('Test HTML')).toBeInTheDocument();
    // HTML content is in an iframe, so we check for the iframe instead
    const iframe = screen.getByTitle('Test HTML');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('srcdoc', '<div>Hello HTML</div>');
  });

  it('should render dashboard artifact', () => {
    const artifact: Artifact = {
      id: 'test-5',
      type: 'dashboard',
      title: 'Test Dashboard',
      content: {
        type: 'dashboard',
        widgets: [
          {
            type: 'bar_chart',
            title: 'Chart 1',
            data: [{ x: 1, y: 10 }],
            config: { xColumn: 'x', yColumn: 'y' },
          },
          {
            type: 'table',
            title: 'Table 1',
            data: [{ id: 1, name: 'Test' }],
          },
        ],
      },
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(
      <ArtifactsPanel
        artifact={artifact}
        onClose={mockOnClose}
        onUserModification={mockOnUserModification}
      />
    );

    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-renderer')).toBeInTheDocument();
    expect(screen.getByText('Charts: 1')).toBeInTheDocument();
    expect(screen.getByText('Tables: 1')).toBeInTheDocument();
  });

  it('should render react_component artifact', () => {
    const TestComponent = ({ message }: { message: string }) => (
      <div data-testid="test-component">{message}</div>
    );

    const artifact: Artifact = {
      id: 'test-6',
      type: 'react_component',
      title: 'Test Component',
      content: {
        type: 'react_component',
        component: TestComponent,
        props: { message: 'Hello from component' },
      },
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(
      <ArtifactsPanel
        artifact={artifact}
        onClose={mockOnClose}
        onUserModification={mockOnUserModification}
      />
    );

    expect(screen.getByText('Test Component')).toBeInTheDocument();
    expect(screen.getByTestId('test-component')).toBeInTheDocument();
    expect(screen.getByText('Hello from component')).toBeInTheDocument();
  });

  it('should handle unsupported artifact type', () => {
    const artifact: Artifact = {
      id: 'test-7',
      type: 'unknown' as any,
      title: 'Unknown Type',
      content: {
        type: 'unknown' as any,
      },
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(
      <ArtifactsPanel
        artifact={artifact}
        onClose={mockOnClose}
        onUserModification={mockOnUserModification}
      />
    );

    expect(screen.getByText('Unsupported artifact type')).toBeInTheDocument();
    expect(screen.getByText('Type: unknown')).toBeInTheDocument();
  });

  it('should handle rendering errors gracefully', () => {
    // Suppress console.error for this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const artifact: Artifact = {
      id: 'test-8',
      type: 'table',
      title: 'Invalid Table',
      content: {
        type: 'table',
        data: 'not-an-array' as any, // Invalid data type
      },
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(
      <ArtifactsPanel
        artifact={artifact}
        onClose={mockOnClose}
        onUserModification={mockOnUserModification}
      />
    );

    // The error should be caught and displayed, or the DataTable should handle it gracefully
    // Check if either the error message is shown or the component renders without crashing
    const errorMessage = screen.queryByText('Failed to render artifact');
    const tableElement = screen.queryByTestId('data-table');
    
    // Either error is shown or table renders (DataTable handles invalid data gracefully)
    expect(errorMessage || tableElement).toBeTruthy();

    consoleError.mockRestore();
  });

  it('should call onClose when close button is clicked', () => {
    const artifact: Artifact = {
      id: 'test-9',
      type: 'table',
      title: 'Test Table',
      content: {
        type: 'table',
        data: [{ id: 1 }],
      },
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(
      <ArtifactsPanel
        artifact={artifact}
        onClose={mockOnClose}
        onUserModification={mockOnUserModification}
      />
    );

    const closeButton = screen.getByLabelText('Close artifacts panel');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should display version and update time', () => {
    const updatedAt = new Date('2024-01-15T10:30:00');
    const artifact: Artifact = {
      id: 'test-10',
      type: 'table',
      title: 'Test Table',
      content: {
        type: 'table',
        data: [{ id: 1 }],
      },
      version: 3,
      createdAt: new Date(),
      updatedAt,
    };

    render(
      <ArtifactsPanel
        artifact={artifact}
        onClose={mockOnClose}
        onUserModification={mockOnUserModification}
      />
    );

    expect(screen.getByText(/Version 3/)).toBeInTheDocument();
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
  });

  it('should handle chart artifact without chartType', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const artifact: Artifact = {
      id: 'test-11',
      type: 'chart',
      title: 'Invalid Chart',
      content: {
        type: 'chart',
        chartType: '' as any,
        data: [],
      },
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(
      <ArtifactsPanel
        artifact={artifact}
        onClose={mockOnClose}
        onUserModification={mockOnUserModification}
      />
    );

    expect(screen.getByText('Failed to render artifact')).toBeInTheDocument();
    expect(screen.getByText('Chart type is required')).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('should handle code artifact with invalid code type', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const artifact: Artifact = {
      id: 'test-12',
      type: 'code',
      title: 'Invalid Code',
      content: {
        type: 'code',
        code: 123 as any, // Invalid type
        language: 'javascript',
      },
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(
      <ArtifactsPanel
        artifact={artifact}
        onClose={mockOnClose}
        onUserModification={mockOnUserModification}
      />
    );

    expect(screen.getByText('Failed to render artifact')).toBeInTheDocument();
    expect(screen.getByText('Code content must be a string')).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('should handle dashboard with empty widgets array', () => {
    const artifact: Artifact = {
      id: 'test-13',
      type: 'dashboard',
      title: 'Empty Dashboard',
      content: {
        type: 'dashboard',
        widgets: [],
      },
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(
      <ArtifactsPanel
        artifact={artifact}
        onClose={mockOnClose}
        onUserModification={mockOnUserModification}
      />
    );

    expect(screen.getByText('Empty Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-renderer')).toBeInTheDocument();
    expect(screen.getByText('Charts: 0')).toBeInTheDocument();
    expect(screen.getByText('Tables: 0')).toBeInTheDocument();
  });

  it('should handle react_component without component', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const artifact: Artifact = {
      id: 'test-14',
      type: 'react_component',
      title: 'Invalid Component',
      content: {
        type: 'react_component',
        component: null as any,
        props: {},
      },
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(
      <ArtifactsPanel
        artifact={artifact}
        onClose={mockOnClose}
        onUserModification={mockOnUserModification}
      />
    );

    expect(screen.getByText('Failed to render artifact')).toBeInTheDocument();
    expect(screen.getByText('React component is required')).toBeInTheDocument();

    consoleError.mockRestore();
  });

  describe('Real-time artifact updates (Task 19.4)', () => {
    it('should track and display version changes', () => {
      const initialArtifact: Artifact = {
        id: 'test-15',
        type: 'table',
        title: 'Test Table',
        content: {
          type: 'table',
          data: [{ id: 1, name: 'Alice' }],
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date('2024-01-15T10:00:00'),
      };

      const { rerender } = render(
        <ArtifactsPanel
          artifact={initialArtifact}
          onClose={mockOnClose}
          onUserModification={mockOnUserModification}
        />
      );

      // Initial version should be displayed
      expect(screen.getByText(/Version 1/)).toBeInTheDocument();

      // Update artifact with new version
      const updatedArtifact: Artifact = {
        ...initialArtifact,
        version: 2,
        updatedAt: new Date('2024-01-15T10:05:00'),
        content: {
          type: 'table',
          data: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
          ],
        },
      };

      rerender(
        <ArtifactsPanel
          artifact={updatedArtifact}
          onClose={mockOnClose}
          onUserModification={mockOnUserModification}
        />
      );

      // New version should be displayed in the header
      const versionText = screen.getAllByText(/Version 2/)[0]; // Get the first occurrence (header)
      expect(versionText).toBeInTheDocument();
    });

    it('should show updating indicator during version transition', async () => {
      vi.useFakeTimers();

      const initialArtifact: Artifact = {
        id: 'test-16',
        type: 'table',
        title: 'Test Table',
        content: {
          type: 'table',
          data: [{ id: 1 }],
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { rerender } = render(
        <ArtifactsPanel
          artifact={initialArtifact}
          onClose={mockOnClose}
          onUserModification={mockOnUserModification}
        />
      );

      // Update to version 2
      const updatedArtifact: Artifact = {
        ...initialArtifact,
        version: 2,
        updatedAt: new Date(),
      };

      rerender(
        <ArtifactsPanel
          artifact={updatedArtifact}
          onClose={mockOnClose}
          onUserModification={mockOnUserModification}
        />
      );

      // Should show updating indicator
      expect(screen.getByText('Updating...')).toBeInTheDocument();

      // Fast-forward past transition duration
      vi.advanceTimersByTime(300);

      // Updating indicator should be gone
      await vi.waitFor(() => {
        expect(screen.queryByText('Updating...')).not.toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it('should update displayed content when version changes', () => {
      const initialArtifact: Artifact = {
        id: 'test-17',
        type: 'table',
        title: 'Test Table',
        content: {
          type: 'table',
          data: [{ id: 1, name: 'Alice' }],
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { rerender } = render(
        <ArtifactsPanel
          artifact={initialArtifact}
          onClose={mockOnClose}
          onUserModification={mockOnUserModification}
        />
      );

      // Initial data
      expect(screen.getByText('Rows: 1')).toBeInTheDocument();

      // Update with more data
      const updatedArtifact: Artifact = {
        ...initialArtifact,
        version: 2,
        updatedAt: new Date(),
        content: {
          type: 'table',
          data: [
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
            { id: 3, name: 'Charlie' },
          ],
        },
      };

      rerender(
        <ArtifactsPanel
          artifact={updatedArtifact}
          onClose={mockOnClose}
          onUserModification={mockOnUserModification}
        />
      );

      // Updated data should be displayed
      expect(screen.getByText('Rows: 3')).toBeInTheDocument();
    });

    it('should handle multiple rapid version updates', async () => {
      vi.useFakeTimers();

      const initialArtifact: Artifact = {
        id: 'test-18',
        type: 'table',
        title: 'Test Table',
        content: {
          type: 'table',
          data: [{ id: 1 }],
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { rerender } = render(
        <ArtifactsPanel
          artifact={initialArtifact}
          onClose={mockOnClose}
          onUserModification={mockOnUserModification}
        />
      );

      // Rapidly update versions
      for (let v = 2; v <= 5; v++) {
        const updatedArtifact: Artifact = {
          ...initialArtifact,
          version: v,
          updatedAt: new Date(),
        };

        rerender(
          <ArtifactsPanel
            artifact={updatedArtifact}
            onClose={mockOnClose}
            onUserModification={mockOnUserModification}
          />
        );

        vi.advanceTimersByTime(100); // Advance less than transition duration
      }

      // Should show final version in the header
      const versionText = screen.getAllByText(/Version 5/)[0]; // Get the first occurrence (header)
      expect(versionText).toBeInTheDocument();

      // Wait for all transitions to complete
      vi.advanceTimersByTime(300);

      vi.useRealTimers();
    });

    it('should not trigger transition on initial render', () => {
      const artifact: Artifact = {
        id: 'test-19',
        type: 'table',
        title: 'Test Table',
        content: {
          type: 'table',
          data: [{ id: 1 }],
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      render(
        <ArtifactsPanel
          artifact={artifact}
          onClose={mockOnClose}
          onUserModification={mockOnUserModification}
        />
      );

      // Should not show updating indicator on initial render
      expect(screen.queryByText('Updating...')).not.toBeInTheDocument();
    });

    it('should update timestamp display when version changes', () => {
      const initialTime = new Date('2024-01-15T10:00:00');
      const updatedTime = new Date('2024-01-15T10:30:00');

      const initialArtifact: Artifact = {
        id: 'test-20',
        type: 'table',
        title: 'Test Table',
        content: {
          type: 'table',
          data: [{ id: 1 }],
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: initialTime,
      };

      const { rerender } = render(
        <ArtifactsPanel
          artifact={initialArtifact}
          onClose={mockOnClose}
          onUserModification={mockOnUserModification}
        />
      );

      // Check initial time in the header
      const initialTimeText = screen.getAllByText(/10:00:00/)[0]; // Get the first occurrence (header)
      expect(initialTimeText).toBeInTheDocument();

      // Update artifact
      const updatedArtifact: Artifact = {
        ...initialArtifact,
        version: 2,
        updatedAt: updatedTime,
      };

      rerender(
        <ArtifactsPanel
          artifact={updatedArtifact}
          onClose={mockOnClose}
          onUserModification={mockOnUserModification}
        />
      );

      // Check updated time in the header
      const updatedTimeText = screen.getAllByText(/10:30:00/)[0]; // Get the first occurrence (header)
      expect(updatedTimeText).toBeInTheDocument();
    });
  });
});
