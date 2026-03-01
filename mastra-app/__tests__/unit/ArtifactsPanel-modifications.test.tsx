import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ArtifactsPanel } from '@/components/ArtifactsPanel';
import type { Artifact, ArtifactModification } from '@/types';

describe('ArtifactsPanel - User Modification Handling (Task 19.6)', () => {
  const mockOnClose = vi.fn();
  const mockOnUserModification = vi.fn();

  const tableArtifact: Artifact = {
    id: 'test-table',
    type: 'table',
    title: 'Test Table',
    content: {
      type: 'table',
      data: [
        { id: 1, name: 'Alice', age: 30 },
        { id: 2, name: 'Bob', age: 25 },
        { id: 3, name: 'Charlie', age: 35 },
      ],
    },
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should emit modification event when user sorts table', () => {
    render(
      <ArtifactsPanel
        artifact={tableArtifact}
        onClose={mockOnClose}
        onUserModification={mockOnUserModification}
      />
    );

    // Click on the 'name' column header to sort
    const nameHeader = screen.getByTestId('sort-header-name');
    fireEvent.click(nameHeader);

    // Should emit modification event with correct structure
    expect(mockOnUserModification).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactId: 'test-table',
        modificationType: 'sort',
        details: {
          column: 'name',
          direction: 'asc',
        },
        timestamp: expect.any(Date),
      })
    );
  });

  it('should emit modification event when user filters table', () => {
    render(
      <ArtifactsPanel
        artifact={tableArtifact}
        onClose={mockOnClose}
        onUserModification={mockOnUserModification}
      />
    );

    // Type in the filter input for 'name' column
    const nameFilter = screen.getByTestId('filter-input-name');
    fireEvent.change(nameFilter, { target: { value: 'Alice' } });

    // Should emit modification event with correct structure
    expect(mockOnUserModification).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactId: 'test-table',
        modificationType: 'filter',
        details: {
          column: 'name',
          value: 'Alice',
          activeFilters: { name: 'Alice' },
        },
        timestamp: expect.any(Date),
      })
    );
  });

  it('should emit multiple modification events for different interactions', () => {
    render(
      <ArtifactsPanel
        artifact={tableArtifact}
        onClose={mockOnClose}
        onUserModification={mockOnUserModification}
      />
    );

    // First, filter by name
    const nameFilter = screen.getByTestId('filter-input-name');
    fireEvent.change(nameFilter, { target: { value: 'Alice' } });

    expect(mockOnUserModification).toHaveBeenCalledTimes(1);
    expect(mockOnUserModification).toHaveBeenLastCalledWith(
      expect.objectContaining({
        modificationType: 'filter',
        details: expect.objectContaining({
          column: 'name',
          value: 'Alice',
        }),
      })
    );

    // Then, sort by age
    const ageHeader = screen.getByTestId('sort-header-age');
    fireEvent.click(ageHeader);

    expect(mockOnUserModification).toHaveBeenCalledTimes(2);
    expect(mockOnUserModification).toHaveBeenLastCalledWith(
      expect.objectContaining({
        modificationType: 'sort',
        details: expect.objectContaining({
          column: 'age',
          direction: 'asc',
        }),
      })
    );
  });

  it('should include artifact ID in modification events', () => {
    render(
      <ArtifactsPanel
        artifact={tableArtifact}
        onClose={mockOnClose}
        onUserModification={mockOnUserModification}
      />
    );

    const nameHeader = screen.getByTestId('sort-header-name');
    fireEvent.click(nameHeader);

    const modification: ArtifactModification = mockOnUserModification.mock.calls[0][0];
    expect(modification.artifactId).toBe('test-table');
  });

  it('should include timestamp in modification events', () => {
    const beforeTime = new Date();

    render(
      <ArtifactsPanel
        artifact={tableArtifact}
        onClose={mockOnClose}
        onUserModification={mockOnUserModification}
      />
    );

    const nameHeader = screen.getByTestId('sort-header-name');
    fireEvent.click(nameHeader);

    const afterTime = new Date();

    const modification: ArtifactModification = mockOnUserModification.mock.calls[0][0];
    expect(modification.timestamp).toBeInstanceOf(Date);
    expect(modification.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(modification.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
  });

  it('should work when onUserModification is not provided', () => {
    // Should not throw error when callback is not provided
    expect(() => {
      render(
        <ArtifactsPanel
          artifact={tableArtifact}
          onClose={mockOnClose}
        />
      );
    }).not.toThrow();

    // Should still allow sorting
    const nameHeader = screen.getByTestId('sort-header-name');
    expect(() => {
      fireEvent.click(nameHeader);
    }).not.toThrow();

    // Should still allow filtering
    const nameFilter = screen.getByTestId('filter-input-name');
    expect(() => {
      fireEvent.change(nameFilter, { target: { value: 'test' } });
    }).not.toThrow();
  });

  it('should emit modification events for different artifact versions', () => {
    const { rerender } = render(
      <ArtifactsPanel
        artifact={tableArtifact}
        onClose={mockOnClose}
        onUserModification={mockOnUserModification}
      />
    );

    // Sort in version 1
    const nameHeader = screen.getByTestId('sort-header-name');
    fireEvent.click(nameHeader);

    expect(mockOnUserModification).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactId: 'test-table',
        modificationType: 'sort',
      })
    );

    // Update to version 2
    const updatedArtifact: Artifact = {
      ...tableArtifact,
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

    // Filter in version 2
    const nameFilter = screen.getByTestId('filter-input-name');
    fireEvent.change(nameFilter, { target: { value: 'Bob' } });

    expect(mockOnUserModification).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactId: 'test-table',
        modificationType: 'filter',
      })
    );

    expect(mockOnUserModification).toHaveBeenCalledTimes(2);
  });
});
