/**
 * Skeleton Loader Component
 * 
 * Provides skeleton loading states for various UI elements.
 * Used to improve perceived performance while content is loading.
 * 
 * Validates: Requirement 1.3 (loading states)
 */

'use client';

interface SkeletonLoaderProps {
  /** Type of skeleton to display */
  variant?: 'message' | 'text' | 'avatar' | 'card';
  /** Number of skeleton items to show */
  count?: number;
  /** Custom className for styling */
  className?: string;
}

/**
 * Skeleton shimmer animation component
 */
function SkeletonShimmer() {
  return (
    <div 
      className="skeleton-shimmer"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)',
        animation: 'shimmer 1.5s infinite',
        pointerEvents: 'none',
      }}
    />
  );
}

/**
 * Message skeleton - shows loading state for a message
 */
function MessageSkeleton() {
  return (
    <div 
      className="flex justify-start mb-4"
      role="status"
      aria-label="Loading message"
    >
      <div className="flex items-start gap-3 w-full max-w-[90%]">
        {/* Avatar skeleton */}
        <div 
          className="skeleton-avatar"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'var(--bg-secondary)',
            position: 'relative',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <SkeletonShimmer />
        </div>
        
        {/* Content skeleton */}
        <div className="flex-1 space-y-2">
          <div 
            className="skeleton-line"
            style={{
              height: '16px',
              width: '80%',
              borderRadius: '4px',
              background: 'var(--bg-secondary)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <SkeletonShimmer />
          </div>
          <div 
            className="skeleton-line"
            style={{
              height: '16px',
              width: '60%',
              borderRadius: '4px',
              background: 'var(--bg-secondary)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <SkeletonShimmer />
          </div>
          <div 
            className="skeleton-line"
            style={{
              height: '16px',
              width: '70%',
              borderRadius: '4px',
              background: 'var(--bg-secondary)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <SkeletonShimmer />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Text skeleton - shows loading state for text content
 */
function TextSkeleton({ width = '100%' }: { width?: string }) {
  return (
    <div 
      className="skeleton-line"
      style={{
        height: '16px',
        width,
        borderRadius: '4px',
        background: 'var(--bg-secondary)',
        position: 'relative',
        overflow: 'hidden',
      }}
      role="status"
      aria-label="Loading text"
    >
      <SkeletonShimmer />
    </div>
  );
}

/**
 * Avatar skeleton - shows loading state for avatar
 */
function AvatarSkeleton() {
  return (
    <div 
      className="skeleton-avatar"
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: 'var(--bg-secondary)',
        position: 'relative',
        overflow: 'hidden',
      }}
      role="status"
      aria-label="Loading avatar"
    >
      <SkeletonShimmer />
    </div>
  );
}

/**
 * Card skeleton - shows loading state for card content
 */
function CardSkeleton() {
  return (
    <div 
      className="skeleton-card"
      style={{
        padding: '16px',
        borderRadius: '12px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        position: 'relative',
        overflow: 'hidden',
      }}
      role="status"
      aria-label="Loading card"
    >
      <div className="space-y-3">
        <TextSkeleton width="60%" />
        <TextSkeleton width="80%" />
        <TextSkeleton width="70%" />
      </div>
      <SkeletonShimmer />
    </div>
  );
}

/**
 * Main SkeletonLoader component
 */
export function SkeletonLoader({ 
  variant = 'message', 
  count = 1,
  className = '',
}: SkeletonLoaderProps) {
  const skeletons = Array.from({ length: count }, (_, i) => i);

  return (
    <div className={className}>
      {skeletons.map((index) => {
        switch (variant) {
          case 'message':
            return <MessageSkeleton key={index} />;
          case 'text':
            return <TextSkeleton key={index} />;
          case 'avatar':
            return <AvatarSkeleton key={index} />;
          case 'card':
            return <CardSkeleton key={index} />;
          default:
            return <MessageSkeleton key={index} />;
        }
      })}
    </div>
  );
}

export default SkeletonLoader;
