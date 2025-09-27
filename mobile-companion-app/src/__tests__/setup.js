// Jest setup for React Native testing

import 'react-native-gesture-handler/jestSetup';

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Expo modules
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestBackgroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({
    coords: {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 5
    },
    timestamp: Date.now()
  })),
  watchPositionAsync: jest.fn(() => Promise.resolve({
    remove: jest.fn()
  })),
  startLocationUpdatesAsync: jest.fn(() => Promise.resolve()),
  stopLocationUpdatesAsync: jest.fn(() => Promise.resolve()),
  Accuracy: {
    BestForNavigation: 6,
    Balanced: 4
  }
}));

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('notification-id')),
  setNotificationHandler: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() }))
}));

jest.mock('expo-camera', () => ({
  Camera: {
    requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    Constants: {
      Type: { back: 'back' },
      FlashMode: { torch: 'torch' }
    }
  }
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  registerTaskAsync: jest.fn()
}));

jest.mock('expo-background-fetch', () => ({
  registerTaskAsync: jest.fn(() => Promise.resolve())
}));

// Mock React Native modules
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: ({ children, ...props }) => React.createElement(View, props, children),
    Marker: ({ children, ...props }) => React.createElement(View, props, children),
    Circle: ({ children, ...props }) => React.createElement(View, props, children),
    Polyline: ({ children, ...props }) => React.createElement(View, props, children)
  };
});

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => ({
    remove: jest.fn()
  }))
}));

jest.mock('react-native-permissions', () => ({
  PermissionsAndroid: {
    requestMultiple: jest.fn(() => Promise.resolve({})),
    PERMISSIONS: {
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
      ACCESS_BACKGROUND_LOCATION: 'android.permission.ACCESS_BACKGROUND_LOCATION',
      CAMERA: 'android.permission.CAMERA',
      SEND_SMS: 'android.permission.SEND_SMS',
      CALL_PHONE: 'android.permission.CALL_PHONE',
      READ_PHONE_STATE: 'android.permission.READ_PHONE_STATE',
      WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE'
    },
    RESULTS: {
      GRANTED: 'granted'
    }
  }
}));

// Mock crypto-js
jest.mock('crypto-js', () => ({
  AES: {
    encrypt: jest.fn((data) => ({ toString: () => 'encrypted-' + data })),
    decrypt: jest.fn((data) => ({ toString: () => data.replace('encrypted-', '') }))
  },
  enc: {
    Utf8: 'utf8'
  }
}));

// Mock Linking
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn(() => Promise.resolve()),
  openSettings: jest.fn(() => Promise.resolve())
}));

// Global test utilities
global.alert = jest.fn();
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn()
};

// Silence specific warnings
const originalWarn = console.warn;
console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('componentWillReceiveProps')
  ) {
    return;
  }
  originalWarn.call(console, ...args);
};