import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import DementiaCareApp from '../DementiaCareApp';

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('DementiaCareApp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    const { getByText } = render(<DementiaCareApp />);

    expect(getByText('Dementia Care Monitor')).toBeTruthy();
    expect(getByText('Production-Grade Patient Safety')).toBeTruthy();
  });

  it('displays HIPAA compliance status', () => {
    const { getByText } = render(<DementiaCareApp />);

    expect(getByText('HIPAA Compliant:')).toBeTruthy();
    expect(getByText('Data encrypted and securely stored')).toBeTruthy();
  });

  it('shows patient information section', () => {
    const { getByPlaceholderText, getByText } = render(<DementiaCareApp />);

    expect(getByText('Patient Information')).toBeTruthy();
    expect(getByPlaceholderText('Patient Name')).toBeTruthy();
    expect(getByPlaceholderText('Primary Caregiver Phone')).toBeTruthy();
  });

  it('shows geofence configuration section', () => {
    const { getByText } = render(<DementiaCareApp />);

    expect(getByText('Safe Zone Configuration')).toBeTruthy();
    expect(getByText('Safe Zone Radius (meters):')).toBeTruthy();
    expect(getByText('Set Current Location as Safe Zone')).toBeTruthy();
  });

  it('shows health monitoring section', () => {
    const { getByText } = render(<DementiaCareApp />);

    expect(getByText('Health Monitoring')).toBeTruthy();
    expect(getByText('❤️ Measure Pulse & Oxygen')).toBeTruthy();
  });

  it('shows emergency actions section', () => {
    const { getByText } = render(<DementiaCareApp />);

    expect(getByText('Emergency Actions')).toBeTruthy();
    expect(getByText('📞 CALL CAREGIVER')).toBeTruthy();
    expect(getByText('🚨 CALL 911')).toBeTruthy();
  });

  it('shows system status section', () => {
    const { getByText } = render(<DementiaCareApp />);

    expect(getByText('System Status')).toBeTruthy();
    expect(getByText('Network:')).toBeTruthy();
    expect(getByText('GPS:')).toBeTruthy();
  });

  it('can add emergency contact', async () => {
    const { getByText } = render(<DementiaCareApp />);

    const addButton = getByText('+ Add Emergency Contact');
    fireEvent.press(addButton);

    // Should trigger Alert.prompt (mocked)
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalled();
    });
  });

  it('shows data management section', () => {
    const { getByText } = render(<DementiaCareApp />);

    expect(getByText('Data Management')).toBeTruthy();
    expect(getByText('Data Retention (days):')).toBeTruthy();
    expect(getByText('📄 Export Health Data')).toBeTruthy();
    expect(getByText('🗑️ Clear All Data')).toBeTruthy();
  });

  it('allows setting patient name', async () => {
    const { getByPlaceholderText } = render(<DementiaCareApp />);

    const patientNameInput = getByPlaceholderText('Patient Name');
    fireEvent.changeText(patientNameInput, 'John Doe');

    expect(patientNameInput.props.value).toBe('John Doe');
  });

  it('allows setting caregiver phone', async () => {
    const { getByPlaceholderText } = render(<DementiaCareApp />);

    const phoneInput = getByPlaceholderText('Primary Caregiver Phone');
    fireEvent.changeText(phoneInput, '555-123-4567');

    expect(phoneInput.props.value).toBe('555-123-4567');
  });

  it('can trigger diagnostics', async () => {
    const { getByText } = render(<DementiaCareApp />);

    const diagnosticsButton = getByText('View Full Diagnostics');
    fireEvent.press(diagnosticsButton);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'System Diagnostics',
        expect.stringContaining('Location History')
      );
    });
  });

  it('shows proper footer information', () => {
    const { getByText } = render(<DementiaCareApp />);

    expect(getByText('Dementia Care Monitor v2.0')).toBeTruthy();
    expect(getByText('HIPAA Compliant • Production Ready')).toBeTruthy();
    expect(getByText('Data encrypted with AES-256 • Secure local storage')).toBeTruthy();
  });

  describe('Health monitoring consent', () => {
    it('requires HIPAA consent for pulse measurement', () => {
      const { getByText } = render(<DementiaCareApp />);

      expect(getByText('Health data collection requires consent')).toBeTruthy();
    });
  });

  describe('Data export functionality', () => {
    it('shows data export alert when pressed', async () => {
      const { getByText } = render(<DementiaCareApp />);

      const exportButton = getByText('📄 Export Health Data');
      fireEvent.press(exportButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Data Export',
          'Export functionality would generate encrypted health and location data for healthcare providers.'
        );
      });
    });
  });

  describe('Data clearing functionality', () => {
    it('shows confirmation alert for data clearing', async () => {
      const { getByText } = render(<DementiaCareApp />);

      const deleteButton = getByText('🗑️ Clear All Data');
      fireEvent.press(deleteButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Clear All Data',
          'This will permanently delete all stored health and location data. This cannot be undone.',
          expect.any(Array)
        );
      });
    });
  });
});