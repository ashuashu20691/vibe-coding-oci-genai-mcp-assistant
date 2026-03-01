import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DataTable } from '@/components/DataTable';

describe('DataTable - User Modifications (Task 19.6)', () => {
  const mockData = [
    { id: 1, name: 'Alice', age: 30 },
    { id: 2, name: 'Bob', age: 25 },
    { id: 3, name: 'Charlie', age: 35 },
  ];

  it('should emit modification event when user sorts a column', () => {
    const onUserModification = vi.fn();

    render(
      <DataTable
        data={mockData}
        title="Test Table"
        onUserModification={onUserModification}
      />
    );

    // Click on the 'name' column header to sort
    const nameHeader = screen.getByTestId('sort-header-name');
    fireEvent.click(nameHeader);

    // Should emit sort modification event
    expect(onUserModification).toHaveBeenCalledWith('sort', {
      column: 'name',
      direction: 'asc',
    });

    // Click again to reverse sort direction
    fireEvent.click(nameHeader);

    expect(onUserModification).toHaveBeenCalledWith('sort', {
      column: 'name',
      direction: 'desc',
    });

    expect(onUserModification).toHaveBeenCalledTimes(2);
  });

  it('should emit modification event when user filters a column', () => {
    const onUserModification = vi.fn();

    render(
      <DataTable
        data={mockData}
        title="Test Table"
        onUserModification={onUserModification}
      />
    );

    // Type in the filter input for 'name' column
    const nameFilter = screen.getByTestId('filter-input-name');
    fireEvent.change(nameFilter, { target: { value: 'Alice' } });

    // Should emit filter modification event
    expect(onUserModification).toHaveBeenCalledWith('filter', {
      column: 'name',
      value: 'Alice',
      activeFilters: { name: 'Alice' },
    });
  });

  it('should emit multiple filter events for different columns', () => {
    const onUserModification = vi.fn();

    render(
      <DataTable
        data={mockData}
        title="Test Table"
        onUserModification={onUserModification}
      />
    );

    // Filter by name
    const nameFilter = screen.getByTestId('filter-input-name');
    fireEvent.change(nameFilter, { target: { value: 'Alice' } });

    expect(onUserModification).toHaveBeenCalledWith('filter', {
      column: 'name',
      value: 'Alice',
      activeFilters: { name: 'Alice' },
    });

    // Filter by age
    const ageFilter = screen.getByTestId('filter-input-age');
    fireEvent.change(ageFilter, { target: { value: '30' } });

    expect(onUserModification).toHaveBeenCalledWith('filter', {
      column: 'age',
      value: '30',
      activeFilters: { name: 'Alice', age: '30' },
    });

    expect(onUserModification).toHaveBeenCalledTimes(2);
  });

  it('should work without onUserModification callback', () => {
    // Should not throw error when callback is not provided
    expect(() => {
      render(<DataTable data={mockData} title="Test Table" />);
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

  it('should emit events with correct details when sorting different columns', () => {
    const onUserModification = vi.fn();

    render(
      <DataTable
        data={mockData}
        title="Test Table"
        onUserModification={onUserModification}
      />
    );

    // Sort by name
    const nameHeader = screen.getByTestId('sort-header-name');
    fireEvent.click(nameHeader);

    expect(onUserModification).toHaveBeenCalledWith('sort', {
      column: 'name',
      direction: 'asc',
    });

    // Sort by age
    const ageHeader = screen.getByTestId('sort-header-age');
    fireEvent.click(ageHeader);

    expect(onUserModification).toHaveBeenCalledWith('sort', {
      column: 'age',
      direction: 'asc',
    });

    expect(onUserModification).toHaveBeenCalledTimes(2);
  });

  it('should clear filter value when user clears input', () => {
    const onUserModification = vi.fn();

    render(
      <DataTable
        data={mockData}
        title="Test Table"
        onUserModification={onUserModification}
      />
    );

    // Add filter
    const nameFilter = screen.getByTestId('filter-input-name');
    fireEvent.change(nameFilter, { target: { value: 'Alice' } });

    expect(onUserModification).toHaveBeenCalledWith('filter', {
      column: 'name',
      value: 'Alice',
      activeFilters: { name: 'Alice' },
    });

    // Clear filter
    fireEvent.change(nameFilter, { target: { value: '' } });

    expect(onUserModification).toHaveBeenCalledWith('filter', {
      column: 'name',
      value: '',
      activeFilters: { name: '' },
    });

    expect(onUserModification).toHaveBeenCalledTimes(2);
  });
});
