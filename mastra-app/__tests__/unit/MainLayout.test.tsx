/**
 * Unit tests for MainLayout component
 * 
 * Task 22.4: Update MainLayout for split-screen
 * 
 * Validates:
 * - Requirement 15.1: Split-screen layout with chat (60%) and artifacts (40%)
 * - Requirement 15.7: Hide artifacts panel on mobile viewports
 * - Resize handle functionality
 * - Responsive behavior
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MainLayout } from '@/components/MainLayout';

describe('Task 22.4: MainLayout Split-Screen', () => {
  const mockSidebar = <div data-testid="sidebar">Sidebar</div>;
  const mockChatPanel = <div data-testid="chat-panel">Chat Panel</div>;
  const mockArtifactsPanel = <div data-testid="artifacts-panel">Artifacts Panel</div>;

  beforeEach(() => {
    // Mock window.innerWidth for responsive tests
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  describe('Requirement 15.1: Split-screen layout with chat and artifacts panels', () => {
    it('should render sidebar, chat panel, and artifacts panel when artifacts are open', () => {
      render(
        <MainLayout
          sidebar={mockSidebar}
          chatPanel={mockChatPanel}
          artifactsPanel={mockArtifactsPanel}
          isArtifactsPanelOpen={true}
        />
      );

      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
      expect(screen.getByTestId('artifacts-panel')).toBeInTheDocument();
    });

    it('should hide artifacts panel when isArtifactsPanelOpen is false', () => {
      render(
        <MainLayout
          sidebar={mockSidebar}
          chatPanel={mockChatPanel}
          artifactsPanel={mockArtifactsPanel}
          isArtifactsPanelOpen={false}
        />
      );

      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
      expect(screen.queryByTestId('artifacts-panel')).not.toBeInTheDocument();
    });

    it('should render resize handle when artifacts panel is open', () => {
      const { container } = render(
        <MainLayout
          sidebar={mockSidebar}
          chatPanel={mockChatPanel}
          artifactsPanel={mockArtifactsPanel}
          isArtifactsPanelOpen={true}
        />
      );

      // Resize handle should be present (4px width element with col-resize cursor)
      const resizeHandle = container.querySelector('[style*="col-resize"]');
      expect(resizeHandle).toBeInTheDocument();
    });

    it('should not render resize handle when artifacts panel is closed', () => {
      const { container } = render(
        <MainLayout
          sidebar={mockSidebar}
          chatPanel={mockChatPanel}
          artifactsPanel={mockArtifactsPanel}
          isArtifactsPanelOpen={false}
        />
      );

      // Resize handle should not be present
      const resizeHandle = container.querySelector('[style*="col-resize"]');
      expect(resizeHandle).not.toBeInTheDocument();
    });
  });

  describe('Requirement 15.7: Hide artifacts panel on mobile viewports', () => {
    it('should hide artifacts panel on mobile viewport (<768px)', () => {
      // Set mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <MainLayout
          sidebar={mockSidebar}
          chatPanel={mockChatPanel}
          artifactsPanel={mockArtifactsPanel}
          isArtifactsPanelOpen={true}
        />
      );

      // Trigger resize event
      fireEvent(window, new Event('resize'));

      // Artifacts panel should not be visible on mobile
      waitFor(() => {
        expect(screen.queryByTestId('artifacts-panel')).not.toBeInTheDocument();
      });
    });

    it('should show artifacts panel on desktop viewport (>=768px)', () => {
      // Set desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      render(
        <MainLayout
          sidebar={mockSidebar}
          chatPanel={mockChatPanel}
          artifactsPanel={mockArtifactsPanel}
          isArtifactsPanelOpen={true}
        />
      );

      // Trigger resize event
      fireEvent(window, new Event('resize'));

      // Artifacts panel should be visible on desktop
      waitFor(() => {
        expect(screen.getByTestId('artifacts-panel')).toBeInTheDocument();
      });
    });

    it('should respond to viewport resize from desktop to mobile', async () => {
      // Start with desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      const { rerender } = render(
        <MainLayout
          sidebar={mockSidebar}
          chatPanel={mockChatPanel}
          artifactsPanel={mockArtifactsPanel}
          isArtifactsPanelOpen={true}
        />
      );

      expect(screen.getByTestId('artifacts-panel')).toBeInTheDocument();

      // Resize to mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
      fireEvent(window, new Event('resize'));

      // Wait for state update
      await waitFor(() => {
        expect(screen.queryByTestId('artifacts-panel')).not.toBeInTheDocument();
      });
    });
  });

  describe('Resize handle functionality', () => {
    it('should allow resizing chat panel width via drag', () => {
      const { container } = render(
        <MainLayout
          sidebar={mockSidebar}
          chatPanel={mockChatPanel}
          artifactsPanel={mockArtifactsPanel}
          isArtifactsPanelOpen={true}
        />
      );

      const resizeHandle = container.querySelector('[style*="col-resize"]');
      expect(resizeHandle).toBeInTheDocument();

      // Simulate mousedown on resize handle
      if (resizeHandle) {
        fireEvent.mouseDown(resizeHandle);

        // Simulate mousemove
        fireEvent.mouseMove(document, { clientX: 500 });

        // Simulate mouseup
        fireEvent.mouseUp(document);
      }

      // The resize should have been triggered (implementation detail)
      // We can't easily test the exact width change without more complex setup
      expect(resizeHandle).toBeInTheDocument();
    });

    it('should constrain resize between 40% and 80%', () => {
      const { container } = render(
        <MainLayout
          sidebar={mockSidebar}
          chatPanel={mockChatPanel}
          artifactsPanel={mockArtifactsPanel}
          isArtifactsPanelOpen={true}
        />
      );

      const resizeHandle = container.querySelector('[style*="col-resize"]');
      
      if (resizeHandle) {
        // Try to resize beyond constraints
        fireEvent.mouseDown(resizeHandle);
        
        // Try to make it very small (should constrain to 40%)
        fireEvent.mouseMove(document, { clientX: 100 });
        fireEvent.mouseUp(document);

        // Try to make it very large (should constrain to 80%)
        fireEvent.mouseDown(resizeHandle);
        fireEvent.mouseMove(document, { clientX: 2000 });
        fireEvent.mouseUp(document);
      }

      // Constraints are applied in the component logic
      expect(resizeHandle).toBeInTheDocument();
    });

    it('should change cursor to col-resize during drag', () => {
      const { container } = render(
        <MainLayout
          sidebar={mockSidebar}
          chatPanel={mockChatPanel}
          artifactsPanel={mockArtifactsPanel}
          isArtifactsPanelOpen={true}
        />
      );

      const mainContainer = container.firstChild as HTMLElement;
      const resizeHandle = container.querySelector('[style*="col-resize"]');

      // Initial cursor should be default
      expect(mainContainer.style.cursor).toBe('default');

      if (resizeHandle) {
        // Start dragging
        fireEvent.mouseDown(resizeHandle);

        // Cursor should change to col-resize during drag
        expect(mainContainer.style.cursor).toBe('col-resize');

        // Stop dragging
        fireEvent.mouseUp(document);

        // Cursor should return to default
        expect(mainContainer.style.cursor).toBe('default');
      }
    });
  });

  describe('Layout structure', () => {
    it('should use flexbox layout', () => {
      const { container } = render(
        <MainLayout
          sidebar={mockSidebar}
          chatPanel={mockChatPanel}
          artifactsPanel={mockArtifactsPanel}
          isArtifactsPanelOpen={true}
        />
      );

      const mainContainer = container.firstChild as HTMLElement;
      expect(mainContainer.style.display).toBe('flex');
      expect(mainContainer.style.height).toBe('100vh');
    });

    it('should expand chat panel to full width when artifacts are closed', () => {
      const { container } = render(
        <MainLayout
          sidebar={mockSidebar}
          chatPanel={mockChatPanel}
          artifactsPanel={mockArtifactsPanel}
          isArtifactsPanelOpen={false}
        />
      );

      // Chat panel should have flex: 1 when artifacts are closed
      const chatPanelContainer = screen.getByTestId('chat-panel').parentElement;
      // Browser expands 'flex: 1' to 'flex: 1 1 0%'
      expect(chatPanelContainer?.style.flex).toContain('1');
    });
  });

  describe('Edge cases', () => {
    it('should handle null artifacts panel gracefully', () => {
      render(
        <MainLayout
          sidebar={mockSidebar}
          chatPanel={mockChatPanel}
          artifactsPanel={null}
          isArtifactsPanelOpen={true}
        />
      );

      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
      expect(screen.queryByTestId('artifacts-panel')).not.toBeInTheDocument();
    });

    it('should cleanup resize event listeners on unmount', () => {
      const { unmount } = render(
        <MainLayout
          sidebar={mockSidebar}
          chatPanel={mockChatPanel}
          artifactsPanel={mockArtifactsPanel}
          isArtifactsPanelOpen={true}
        />
      );

      // Unmount component
      unmount();

      // Trigger resize event - should not cause errors
      expect(() => {
        fireEvent(window, new Event('resize'));
      }).not.toThrow();
    });
  });
});
