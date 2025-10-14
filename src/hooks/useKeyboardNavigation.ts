// src/hooks/useKeyboardNavigation.ts
// Comprehensive keyboard navigation support for interactive elements

import { useEffect, useCallback, useRef } from 'react';

interface UseKeyboardNavigationOptions {
  enabled?: boolean;
  onEscape?: () => void;
  onEnter?: () => void;
  trapFocus?: boolean;
  returnFocusOnCleanup?: boolean;
}

export function useKeyboardNavigation(options: UseKeyboardNavigationOptions = {}) {
  const {
    enabled = true,
    onEscape,
    onEnter,
    trapFocus = false,
    returnFocusOnCleanup = false,
  } = options;

  const previousActiveElement = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  // Store the previously focused element
  useEffect(() => {
    if (enabled && returnFocusOnCleanup) {
      previousActiveElement.current = document.activeElement as HTMLElement;
    }

    return () => {
      if (returnFocusOnCleanup && previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [enabled, returnFocusOnCleanup]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Escape key
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault();
        onEscape();
        return;
      }

      // Enter key
      if (event.key === 'Enter' && onEnter) {
        event.preventDefault();
        onEnter();
        return;
      }

      // Tab key for focus trapping
      if (trapFocus && event.key === 'Tab' && containerRef.current) {
        const focusableElements = getFocusableElements(containerRef.current);
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    },
    [enabled, onEscape, onEnter, trapFocus]
  );

  // Attach keyboard event listener
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  return { containerRef };
}

// Get all focusable elements within a container
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  return Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
}

// Hook for arrow key navigation in lists/grids
interface UseArrowNavigationOptions {
  enabled?: boolean;
  orientation?: 'vertical' | 'horizontal' | 'grid';
  loop?: boolean;
  itemCount: number;
  columnsCount?: number; // For grid orientation
  onSelect?: (index: number) => void;
}

export function useArrowNavigation(options: UseArrowNavigationOptions) {
  const {
    enabled = true,
    orientation = 'vertical',
    loop = true,
    itemCount,
    columnsCount = 1,
    onSelect,
  } = options;

  const currentIndexRef = useRef(0);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled || itemCount === 0) return;

      let newIndex = currentIndexRef.current;
      let handled = false;

      switch (event.key) {
        case 'ArrowUp':
          if (orientation === 'vertical' || orientation === 'grid') {
            newIndex = orientation === 'grid'
              ? currentIndexRef.current - columnsCount
              : currentIndexRef.current - 1;
            handled = true;
          }
          break;

        case 'ArrowDown':
          if (orientation === 'vertical' || orientation === 'grid') {
            newIndex = orientation === 'grid'
              ? currentIndexRef.current + columnsCount
              : currentIndexRef.current + 1;
            handled = true;
          }
          break;

        case 'ArrowLeft':
          if (orientation === 'horizontal' || orientation === 'grid') {
            newIndex = currentIndexRef.current - 1;
            handled = true;
          }
          break;

        case 'ArrowRight':
          if (orientation === 'horizontal' || orientation === 'grid') {
            newIndex = currentIndexRef.current + 1;
            handled = true;
          }
          break;

        case 'Home':
          newIndex = 0;
          handled = true;
          break;

        case 'End':
          newIndex = itemCount - 1;
          handled = true;
          break;

        case 'Enter':
        case ' ':
          if (onSelect) {
            event.preventDefault();
            onSelect(currentIndexRef.current);
          }
          return;
      }

      if (handled) {
        event.preventDefault();

        // Handle looping
        if (loop) {
          newIndex = ((newIndex % itemCount) + itemCount) % itemCount;
        } else {
          newIndex = Math.max(0, Math.min(itemCount - 1, newIndex));
        }

        // Only update if index actually changed
        if (newIndex !== currentIndexRef.current) {
          currentIndexRef.current = newIndex;

          // Focus the element
          const element = document.querySelector(
            `[data-nav-index="${newIndex}"]`
          ) as HTMLElement;
          if (element) {
            element.focus();
          }
        }
      }
    },
    [enabled, orientation, loop, itemCount, columnsCount, onSelect]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  const getItemProps = useCallback(
    (index: number) => ({
      'data-nav-index': index,
      tabIndex: index === currentIndexRef.current ? 0 : -1,
      onFocus: () => {
        currentIndexRef.current = index;
      },
    }),
    []
  );

  return { getItemProps, currentIndex: currentIndexRef.current };
}

// Hook for skip links (a11y)
export function useSkipLinks() {
  const skipToMainContent = useCallback(() => {
    const mainContent = document.querySelector('main') || document.querySelector('[role="main"]');
    if (mainContent) {
      (mainContent as HTMLElement).focus();
      (mainContent as HTMLElement).scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  return { skipToMainContent };
}
