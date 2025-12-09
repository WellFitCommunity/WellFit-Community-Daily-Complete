/**
 * useCapabilities Hook
 * Detects browser capabilities for vital capture methods
 */

import { useState, useEffect } from 'react';
import { CaptureCapabilities } from './types';

/**
 * Detect browser capabilities for different capture methods
 */
export function useCapabilities(): CaptureCapabilities {
  const [capabilities, setCapabilities] = useState<CaptureCapabilities>({
    hasCamera: false,
    hasWebBluetooth: false,
    hasSpeechRecognition: false,
    isSecureContext: false,
    isMobile: false,
    isAndroid: false,
    isIOS: false,
  });

  useEffect(() => {
    const detectCapabilities = async () => {
      // Check secure context (required for camera, BLE, etc.)
      const isSecureContext = window.isSecureContext;

      // Detect mobile/tablet
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      const isAndroid = /android/i.test(userAgent);
      const isIOS = /iphone|ipad|ipod/i.test(userAgent);

      // Check camera availability
      let hasCamera = false;
      if (isSecureContext && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
        try {
          // Check if any video input devices exist
          const devices = await navigator.mediaDevices.enumerateDevices();
          hasCamera = devices.some(device => device.kind === 'videoinput');
        } catch {
          // Permission denied or not available
          hasCamera = false;
        }
      }

      // Check Web Bluetooth availability
      // Note: navigator.bluetooth exists in Chrome/Edge on Android and desktop
      // It does NOT exist on iOS Safari
      const hasWebBluetooth = !!(navigator as Navigator & { bluetooth?: unknown }).bluetooth;

      // Check speech recognition (for voice notes)
      const hasSpeechRecognition = !!(
        (window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
        (window as Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
      );

      setCapabilities({
        hasCamera,
        hasWebBluetooth,
        hasSpeechRecognition,
        isSecureContext,
        isMobile,
        isAndroid,
        isIOS,
      });
    };

    detectCapabilities();
  }, []);

  return capabilities;
}

/**
 * Get a human-readable description of why a feature is unavailable
 */
export function getCapabilityMessage(
  capability: keyof CaptureCapabilities,
  capabilities: CaptureCapabilities
): string | null {
  if (!capabilities.isSecureContext) {
    return 'This feature requires a secure connection (HTTPS)';
  }

  switch (capability) {
    case 'hasCamera':
      if (!capabilities.hasCamera) {
        return 'No camera detected on this device';
      }
      break;

    case 'hasWebBluetooth':
      if (!capabilities.hasWebBluetooth) {
        if (capabilities.isIOS) {
          return 'Bluetooth is not supported in Safari. Please use camera or manual entry.';
        }
        return 'Bluetooth is not supported in this browser. Try Chrome or Edge on Android or desktop.';
      }
      break;

    case 'hasSpeechRecognition':
      if (!capabilities.hasSpeechRecognition) {
        return 'Voice input is not supported in this browser';
      }
      break;
  }

  return null;
}

export default useCapabilities;
