import React from 'react';
import { StatusBar } from 'expo-status-bar';
import DementiaCareApp from './src/DementiaCareApp';

export default function App() {
  return (
    <>
      <StatusBar style="light" backgroundColor="#2196F3" />
      <DementiaCareApp />
    </>
  );
}