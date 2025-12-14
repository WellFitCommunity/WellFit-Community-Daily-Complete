/**
 * useTouchGestures Hook
 *
 * Provides touch gesture support for mobile/tablet interactions with the avatar.
 */

import { useRef, useCallback, useEffect, useState } from 'react';

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
  isSwiping: boolean;
}

interface UseTouchGesturesOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onTap?: (x: number, y: number) => void;
  onLongPress?: (x: number, y: number) => void;
  onPinchZoom?: (scale: number) => void;
  swipeThreshold?: number;
  longPressDelay?: number;
  enabled?: boolean;
}

interface UseTouchGesturesResult {
  touchHandlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
  isTouching: boolean;
  lastGesture: string | null;
}

/**
 * Calculate distance between two touch points
 */
function getDistance(touch1: React.Touch, touch2: React.Touch): number {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * useTouchGestures hook
 */
export function useTouchGestures(
  options: UseTouchGesturesOptions
): UseTouchGesturesResult {
  const {
    onSwipeLeft,
    onSwipeRight,
    onTap,
    onLongPress,
    onPinchZoom,
    swipeThreshold = 50,
    longPressDelay = 500,
    enabled = true,
  } = options;

  const touchState = useRef<TouchState | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const initialPinchDistance = useRef<number | null>(null);
  const [isTouching, setIsTouching] = useState(false);
  const [lastGesture, setLastGesture] = useState<string | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;

      setIsTouching(true);
      const touch = e.touches[0];

      touchState.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        isSwiping: false,
      };

      // Handle pinch start (two fingers)
      if (e.touches.length === 2) {
        initialPinchDistance.current = getDistance(e.touches[0], e.touches[1]);
        return;
      }

      // Set up long press detection
      if (onLongPress) {
        longPressTimer.current = setTimeout(() => {
          if (touchState.current && !touchState.current.isSwiping) {
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            const x = ((touch.clientX - rect.left) / rect.width) * 100;
            const y = ((touch.clientY - rect.top) / rect.height) * 100;
            onLongPress(x, y);
            setLastGesture('longpress');
            touchState.current = null;
          }
        }, longPressDelay);
      }
    },
    [enabled, onLongPress, longPressDelay]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !touchState.current) return;

      const touch = e.touches[0];
      const dx = touch.clientX - touchState.current.startX;
      const dy = touch.clientY - touchState.current.startY;

      // Handle pinch zoom
      if (e.touches.length === 2 && initialPinchDistance.current && onPinchZoom) {
        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const scale = currentDistance / initialPinchDistance.current;
        onPinchZoom(scale);
        return;
      }

      // Detect if user is swiping
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        touchState.current.isSwiping = true;

        // Cancel long press if swiping
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }
    },
    [enabled, onPinchZoom]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;

      setIsTouching(false);

      // Clear long press timer
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      // Reset pinch
      initialPinchDistance.current = null;

      if (!touchState.current) return;

      const { startX, startY, startTime, isSwiping } = touchState.current;
      const endTouch = e.changedTouches[0];
      const dx = endTouch.clientX - startX;
      const dy = endTouch.clientY - startY;
      const duration = Date.now() - startTime;

      // Detect swipe
      if (isSwiping && Math.abs(dx) > swipeThreshold) {
        if (dx > 0 && onSwipeRight) {
          onSwipeRight();
          setLastGesture('swipe-right');
        } else if (dx < 0 && onSwipeLeft) {
          onSwipeLeft();
          setLastGesture('swipe-left');
        }
      }
      // Detect tap (short duration, minimal movement)
      else if (!isSwiping && duration < 300 && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        if (onTap) {
          const rect = (e.target as HTMLElement).getBoundingClientRect();
          const x = ((endTouch.clientX - rect.left) / rect.width) * 100;
          const y = ((endTouch.clientY - rect.top) / rect.height) * 100;
          onTap(x, y);
          setLastGesture('tap');
        }
      }

      touchState.current = null;
    },
    [enabled, onSwipeLeft, onSwipeRight, onTap, swipeThreshold]
  );

  return {
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    isTouching,
    lastGesture,
  };
}

export default useTouchGestures;
