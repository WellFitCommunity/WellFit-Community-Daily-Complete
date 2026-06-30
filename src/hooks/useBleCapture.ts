/**
 * useBleCapture - Reusable Web Bluetooth vital-capture hook
 *
 * Purpose: Wraps the BLE connection engine (`bleConnectionManager`) + browser
 * capability detection into a single hook a device page can use to pair a
 * standard-GATT medical device, receive readings, and persist them via a
 * caller-supplied handler. Senior-proofing: honest capability gating (no pair
 * option on iPhone/iPad or non-Chrome), friendly-device memory, and best-effort
 * silent reconnect to a previously-paired device so the chooser does not reappear.
 *
 * Used by: src/pages/devices/* (BloodPressureMonitorPage, GlucometerPage, etc.)
 *
 * NOTE: Web Bluetooth is unsupported on iOS/iPadOS (all browsers) and Firefox.
 * On those platforms `isSupported` is false and the page must fall back to manual entry.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { bleConnectionManager } from '../services/ble/bleConnectionManager';
import { useCapabilities, getCapabilityMessage } from '../components/vitals/useCapabilities';
import { auditLogger } from '../services/auditLogger';
import type { BleDeviceType, BleVitalReading } from '../types/ble';

export type BleCaptureStatus =
  | 'unsupported'
  | 'idle'
  | 'pairing'
  | 'connected'
  | 'error'
  | 'disconnected';

export interface UseBleCaptureOptions {
  deviceType: BleDeviceType;
  /** Called for every reading received from the device. May persist it. */
  onReading: (reading: BleVitalReading) => void | Promise<void>;
}

export interface UseBleCaptureResult {
  /** True only where Web Bluetooth actually works (Chrome/Edge on Android/desktop, secure context). */
  isSupported: boolean;
  isIOS: boolean;
  /** Human-readable reason BLE is unavailable (for display), or null when supported. */
  capabilityMessage: string | null;
  status: BleCaptureStatus;
  /** Name of the connected device (friendly name from the device itself), or null. */
  deviceName: string | null;
  lastReading: BleVitalReading | null;
  error: string | null;
  /** Open the system chooser to pair a device, then connect + subscribe. */
  pair: () => Promise<void>;
  disconnect: () => Promise<void>;
}

function storageKey(deviceType: BleDeviceType): string {
  return `ble_device_id_${deviceType}`;
}

export function useBleCapture({ deviceType, onReading }: UseBleCaptureOptions): UseBleCaptureResult {
  const capabilities = useCapabilities();
  const isSupported = capabilities.hasWebBluetooth && capabilities.isSecureContext;

  const [status, setStatus] = useState<BleCaptureStatus>('idle');
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [lastReading, setLastReading] = useState<BleVitalReading | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deviceIdRef = useRef<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  // Keep the latest onReading without forcing re-subscription.
  const onReadingRef = useRef(onReading);
  onReadingRef.current = onReading;

  useEffect(() => {
    if (!isSupported) {
      setStatus('unsupported');
    } else {
      setStatus((prev) => (prev === 'unsupported' ? 'idle' : prev));
    }
  }, [isSupported]);

  const handleReading = useCallback(
    (reading: BleVitalReading) => {
      setLastReading(reading);
      setStatus('connected');
      void Promise.resolve(onReadingRef.current(reading)).catch((err: unknown) => {
        void auditLogger.error(
          'BLE_ONREADING_HANDLER_FAILED',
          err instanceof Error ? err : new Error(String(err)),
          { deviceType }
        );
      });
    },
    [deviceType]
  );

  const pair = useCallback(async () => {
    if (!isSupported) return;
    setError(null);
    setStatus('pairing');

    const reqResult = await bleConnectionManager.requestDevice(deviceType);
    if (!reqResult.success) {
      setError(reqResult.error.message);
      setStatus('error');
      return;
    }

    const connResult = await bleConnectionManager.connectDevice(reqResult.data, deviceType);
    if (!connResult.success) {
      setError(connResult.error.message);
      setStatus('error');
      return;
    }

    deviceIdRef.current = connResult.data.id;
    setDeviceName(connResult.data.name);
    setStatus('connected');
    try {
      localStorage.setItem(storageKey(deviceType), connResult.data.id);
    } catch {
      // localStorage unavailable — silent reconnect just won't be available.
    }

    const subResult = await bleConnectionManager.subscribeToReadings(
      connResult.data.id,
      handleReading
    );
    if (!subResult.success) {
      setError(subResult.error.message);
      setStatus('error');
      return;
    }
    unsubscribeRef.current = subResult.data;
  }, [deviceType, handleReading, isSupported]);

  const disconnect = useCallback(async () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (deviceIdRef.current) {
      await bleConnectionManager.disconnectDevice(deviceIdRef.current);
      deviceIdRef.current = null;
    }
    setDeviceName(null);
    setStatus('disconnected');
  }, []);

  // Best-effort silent reconnect to a previously-paired device (no chooser).
  // Only works where navigator.bluetooth.getDevices is implemented and the
  // device was granted before. Failure is non-fatal — the user can re-pair.
  useEffect(() => {
    if (!isSupported) return;
    let cancelled = false;

    const tryReconnect = async () => {
      const bt = (navigator as Navigator & {
        bluetooth?: { getDevices?: () => Promise<BluetoothDevice[]> };
      }).bluetooth;
      if (!bt?.getDevices) return;

      let savedId: string | null = null;
      try {
        savedId = localStorage.getItem(storageKey(deviceType));
      } catch {
        return;
      }
      if (!savedId) return;

      try {
        const known = await bt.getDevices();
        const device = known.find((d) => d.id === savedId);
        if (!device || cancelled) return;

        const connResult = await bleConnectionManager.connectDevice(device, deviceType);
        if (!connResult.success || cancelled) return;

        deviceIdRef.current = connResult.data.id;
        setDeviceName(connResult.data.name);
        setStatus('connected');

        const subResult = await bleConnectionManager.subscribeToReadings(
          connResult.data.id,
          handleReading
        );
        if (subResult.success && !cancelled) {
          unsubscribeRef.current = subResult.data;
        }
      } catch {
        // Best-effort only.
      }
    };

    void tryReconnect();
    return () => {
      cancelled = true;
    };
  }, [isSupported, deviceType, handleReading]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
      if (deviceIdRef.current) void bleConnectionManager.disconnectDevice(deviceIdRef.current);
    };
  }, []);

  return {
    isSupported,
    isIOS: capabilities.isIOS,
    capabilityMessage: isSupported ? null : getCapabilityMessage('hasWebBluetooth', capabilities),
    status,
    deviceName,
    lastReading,
    error,
    pair,
    disconnect,
  };
}

export default useBleCapture;
