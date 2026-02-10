/**
 * BLE (Bluetooth Low Energy) Types
 *
 * Type definitions for Web Bluetooth API device connections,
 * medical device profiles, and vital reading extraction.
 */

// -- Device Profiles ----------------------------------------------------------

export type BleDeviceType =
  | 'blood_pressure'
  | 'glucose_meter'
  | 'pulse_oximeter'
  | 'weight_scale'
  | 'thermometer';

export type BleConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface BleDeviceProfile {
  deviceType: BleDeviceType;
  name: string;
  serviceUuid: string;
  characteristicUuid: string;
  manufacturer?: string;
  parseReading: (dataView: DataView) => BleVitalReading;
}

export interface BleConnectedDevice {
  id: string;
  name: string;
  deviceType: BleDeviceType;
  status: BleConnectionStatus;
  lastReadingAt: string | null;
  batteryLevel: number | null;
  rssi: number | null;
}

// -- Vital Readings -----------------------------------------------------------

export interface BleVitalReading {
  deviceType: BleDeviceType;
  timestamp: string;
  values: BleVitalValue[];
  rawData?: string;
}

export interface BleVitalValue {
  type: string;
  value: number;
  unit: string;
}

// -- Connection Events --------------------------------------------------------

export type BleEventType =
  | 'connected'
  | 'disconnected'
  | 'reading'
  | 'error'
  | 'battery';

export interface BleEvent {
  type: BleEventType;
  deviceId: string;
  timestamp: string;
  data?: unknown;
}

// -- Manager Configuration ----------------------------------------------------

export interface BleManagerConfig {
  autoReconnect: boolean;
  reconnectAttempts: number;
  reconnectDelay: number;
  readingInterval: number;
  offlineQueueSize: number;
}
