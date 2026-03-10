/**
 * Unit tests for SkeletonLoader component
 * Task 9.5: Implement loading states and skeleton loaders
 * Validates: Requirement 1.3
 */

import { render, screen } from '@testing-library/react';
import { SkeletonLoader } from '@/components/SkeletonLoader';

describe('SkeletonLoader', () => {
  describe('Message variant', () => {
    it('should render message skeleton with avatar and content lines', () => {
      const { container } = render(<SkeletonLoader variant="message" count={1} />);
      
      // Check for loading message status
      expect(screen.getByRole('status', { name: /loading message/i })).toBeInTheDocument();
      
      // Check for avatar skeleton element (not a separate role, but part of the message)
      const avatarSkeleton = container.querySelector('.skeleton-avatar');
      expect(avatarSkeleton).toBeInTheDocument();
      
      // Check for content line skeletons
      const contentLines = container.querySelectorAll('.skeleton-line');
      expect(contentLines.length).toBeGreaterThan(0);
    });

    it('should render multiple message skeletons when count is specified', () => {
      render(<SkeletonLoader variant="message" count={3} />);
      
      const messageSkeletons = screen.getAllByRole('status', { name: /loading message/i });
      expect(messageSkeletons).toHaveLength(3);
    });
  });

  describe('Text variant', () => {
    it('should render text skeleton', () => {
      render(<SkeletonLoader variant="text" count={1} />);
      
      expect(screen.getByRole('status', { name: /loading text/i })).toBeInTheDocument();
    });

    it('should render multiple text skeletons', () => {
      render(<SkeletonLoader variant="text" count={5} />);
      
      const textSkeletons = screen.getAllByRole('status', { name: /loading text/i });
      expect(textSkeletons).toHaveLength(5);
    });
  });

  describe('Avatar variant', () => {
    it('should render avatar skeleton', () => {
      render(<SkeletonLoader variant="avatar" count={1} />);
      
      expect(screen.getByRole('status', { name: /loading avatar/i })).toBeInTheDocument();
    });
  });

  describe('Card variant', () => {
    it('should render card skeleton with text lines', () => {
      render(<SkeletonLoader variant="card" count={1} />);
      
      expect(screen.getByRole('status', { name: /loading card/i })).toBeInTheDocument();
    });

    it('should render multiple card skeletons', () => {
      render(<SkeletonLoader variant="card" count={2} />);
      
      const cardSkeletons = screen.getAllByRole('status', { name: /loading card/i });
      expect(cardSkeletons).toHaveLength(2);
    });
  });

  describe('Default behavior', () => {
    it('should default to message variant when no variant specified', () => {
      render(<SkeletonLoader />);
      
      expect(screen.getByRole('status', { name: /loading message/i })).toBeInTheDocument();
    });

    it('should default to count of 1 when no count specified', () => {
      render(<SkeletonLoader variant="text" />);
      
      const textSkeletons = screen.getAllByRole('status', { name: /loading text/i });
      expect(textSkeletons).toHaveLength(1);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for screen readers', () => {
      render(<SkeletonLoader variant="message" count={1} />);
      
      // All skeleton elements should have role="status" for screen reader announcements
      const statusElements = screen.getAllByRole('status');
      expect(statusElements.length).toBeGreaterThan(0);
    });
  });

  describe('Styling', () => {
    it('should apply custom className when provided', () => {
      const { container } = render(
        <SkeletonLoader variant="message" count={1} className="custom-class" />
      );
      
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});
