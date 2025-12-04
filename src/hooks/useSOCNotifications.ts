/**
 * useSOCNotifications Hook
 *
 * Handles browser notifications and audio alerts for the SOC Dashboard.
 * Manages permission requests and notification preferences.
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import { SOCNotificationPreferences, SoundType, SOUND_FILES } from '../types/socDashboard';

interface UseSOCNotificationsReturn {
  playSound: (sound: SoundType) => void;
  showNotification: (title: string, body: string, options?: NotificationOptions) => void;
  requestPermission: () => Promise<NotificationPermission>;
  permissionStatus: NotificationPermission | 'unsupported';
  isAudioEnabled: boolean;
  setAudioEnabled: (enabled: boolean) => void;
}

export function useSOCNotifications(
  preferences: SOCNotificationPreferences | null
): UseSOCNotificationsReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [isAudioEnabled, setAudioEnabled] = useState(true);

  // Initialize audio element
  useEffect(() => {
    if (typeof Audio !== 'undefined') {
      audioRef.current = new Audio();
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Check permission status on mount
  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  // Play sound for alert
  const playSound = useCallback((sound: SoundType) => {
    if (!isAudioEnabled || !preferences?.sound_enabled) {
      return;
    }

    if (sound === 'none' || !SOUND_FILES[sound]) {
      return;
    }

    const soundFile = SOUND_FILES[sound];
    if (!soundFile || !audioRef.current) {
      return;
    }

    try {
      audioRef.current.src = soundFile;
      audioRef.current.volume = 0.7;
      audioRef.current.play().catch(() => {
        // Audio playback may be blocked by browser autoplay policy
        // This is expected on first page load before user interaction
        // Silently ignore - audio is a nice-to-have enhancement
      });
    } catch (err) {
      // Silently fail - audio is a nice-to-have
    }
  }, [isAudioEnabled, preferences?.sound_enabled]);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (typeof Notification === 'undefined') {
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      return permission;
    } catch (err) {
      return 'denied';
    }
  }, []);

  // Show browser notification
  const showNotification = useCallback((
    title: string,
    body: string,
    options?: NotificationOptions
  ) => {
    if (!preferences?.browser_notifications_enabled) {
      return;
    }

    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return;
    }

    try {
      const notification = new Notification(title, {
        body,
        icon: '/logo192.png',
        badge: '/logo192.png',
        tag: 'soc-alert',
        renotify: true,
        requireInteraction: true,
        ...options,
      });

      // Auto-close after 10 seconds
      setTimeout(() => {
        notification.close();
      }, 10000);

      // Focus window on click
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (err) {
      // Silently fail - notification is a nice-to-have
    }
  }, [preferences?.browser_notifications_enabled]);

  return {
    playSound,
    showNotification,
    requestPermission,
    permissionStatus,
    isAudioEnabled,
    setAudioEnabled,
  };
}

export default useSOCNotifications;
