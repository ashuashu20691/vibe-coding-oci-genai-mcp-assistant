import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useArtifacts } from '@/hooks/useArtifacts';
import type { Artifact } from '@/types';

describe('useArtifacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with null artifact and closed state', () => {
    const { result } = renderHook(() => useArtifacts());

    expect(result.current.artifact).toBeNull();
    expect(result.current.isOpen).toBe(false);
  });

  it('should set artifact and open panel', () => {
    const { result } = renderHook(() => useArtifacts());

    const artifact: Artifact = {
      id: 'test-1',
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

    act(() => {
      result.current.setArtifact(artifact);
    });

    expect(result.current.artifact).toEqual(artifact);
    expect(result.current.isOpen).toBe(true);
  });

  it('should close panel without clearing artifact', () => {
    const { result } = renderHook(() => useArtifacts());

    const artifact: Artifact = {
      id: 'test-2',
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

    act(() => {
      result.current.setArtifact(artifact);
    });

    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.closePanel();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.artifact).toEqual(artifact); // Artifact still in state
  });

  it('should clear artifact when set to null', () => {
    const { result } = renderHook(() => useArtifacts());

    const artifact: Artifact = {
      id: 'test-3',
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

    act(() => {
      result.current.setArtifact(artifact);
    });

    expect(result.current.artifact).toEqual(artifact);

    act(() => {
      result.current.setArtifact(null);
    });

    expect(result.current.artifact).toBeNull();
    expect(result.current.isOpen).toBe(false);
  });

  describe('Real-time artifact updates (Task 19.4)', () => {
    it('should increment version when updating artifact', () => {
      const { result } = renderHook(() => useArtifacts());

      const artifact: Artifact = {
        id: 'test-4',
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

      act(() => {
        result.current.setArtifact(artifact);
      });

      expect(result.current.artifact?.version).toBe(1);

      // Update artifact content
      act(() => {
        result.current.updateArtifact({
          content: {
            type: 'table',
            data: [
              { id: 1, name: 'Alice' },
              { id: 2, name: 'Bob' },
            ],
          },
        });
      });

      expect(result.current.artifact?.version).toBe(2);
    });

    it('should update timestamp when updating artifact', () => {
      vi.useFakeTimers();
      const initialTime = new Date('2024-01-15T10:00:00');
      vi.setSystemTime(initialTime);

      const { result } = renderHook(() => useArtifacts());

      const artifact: Artifact = {
        id: 'test-5',
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

      act(() => {
        result.current.setArtifact(artifact);
      });

      const firstUpdateTime = result.current.artifact?.updatedAt;

      // Advance time
      const laterTime = new Date('2024-01-15T10:30:00');
      vi.setSystemTime(laterTime);

      act(() => {
        result.current.updateArtifact({
          title: 'Updated Table',
        });
      });

      const secondUpdateTime = result.current.artifact?.updatedAt;

      expect(secondUpdateTime).not.toEqual(firstUpdateTime);
      expect(secondUpdateTime?.getTime()).toBeGreaterThan(firstUpdateTime?.getTime() || 0);

      vi.useRealTimers();
    });

    it('should preserve other properties when updating artifact', () => {
      const { result } = renderHook(() => useArtifacts());

      const artifact: Artifact = {
        id: 'test-6',
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

      act(() => {
        result.current.setArtifact(artifact);
      });

      act(() => {
        result.current.updateArtifact({
          title: 'Updated Title',
        });
      });

      expect(result.current.artifact?.id).toBe('test-6');
      expect(result.current.artifact?.type).toBe('table');
      expect(result.current.artifact?.title).toBe('Updated Title');
      expect(result.current.artifact?.content).toEqual(artifact.content);
      expect(result.current.artifact?.version).toBe(2);
    });

    it('should handle multiple sequential updates', () => {
      const { result } = renderHook(() => useArtifacts());

      const artifact: Artifact = {
        id: 'test-7',
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

      act(() => {
        result.current.setArtifact(artifact);
      });

      // Multiple updates
      act(() => {
        result.current.updateArtifact({ title: 'Update 1' });
      });
      expect(result.current.artifact?.version).toBe(2);

      act(() => {
        result.current.updateArtifact({ title: 'Update 2' });
      });
      expect(result.current.artifact?.version).toBe(3);

      act(() => {
        result.current.updateArtifact({ title: 'Update 3' });
      });
      expect(result.current.artifact?.version).toBe(4);

      expect(result.current.artifact?.title).toBe('Update 3');
    });

    it('should increment version on user modification', () => {
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { result } = renderHook(() => useArtifacts());

      const artifact: Artifact = {
        id: 'test-8',
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

      act(() => {
        result.current.setArtifact(artifact);
      });

      expect(result.current.artifact?.version).toBe(1);

      // User modifies artifact with filter
      act(() => {
        result.current.onUserModification({
          artifactId: 'test-8',
          modificationType: 'filter',
          details: { column: 'name', value: 'Alice' },
        });
      });

      expect(result.current.artifact?.version).toBe(2);
      expect(consoleLog).toHaveBeenCalledWith(
        'User filtered artifact: column="name", value="Alice"'
      );

      consoleLog.mockRestore();
    });

    it('should not update artifact if null', () => {
      const { result } = renderHook(() => useArtifacts());

      act(() => {
        result.current.updateArtifact({ title: 'Should not update' });
      });

      expect(result.current.artifact).toBeNull();
    });

    it('should not increment version on user modification if artifact is null', () => {
      const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { result } = renderHook(() => useArtifacts());

      act(() => {
        result.current.onUserModification({
          artifactId: 'test-9',
          modificationType: 'sort',
          details: {},
        });
      });

      expect(result.current.artifact).toBeNull();

      consoleLog.mockRestore();
    });
  });
});
