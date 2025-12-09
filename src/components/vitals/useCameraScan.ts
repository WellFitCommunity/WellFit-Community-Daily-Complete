/**
 * useCameraScan Hook
 * Live camera scanning for vital sign displays using client-side OCR
 * No images are uploaded - all processing happens in browser memory
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { VitalReading, VitalType, BloodPressureReading } from './types';

export interface CameraScanState {
  isScanning: boolean;
  hasPermission: boolean | null;
  error: string | null;
  lastReading: VitalReading | null;
  confidence: number;
  rawText: string;
}

export interface UseCameraScanResult {
  state: CameraScanState;
  startScanning: (vitalType: VitalType) => Promise<void>;
  stopScanning: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

// Debounce threshold - readings must be stable for this many consecutive frames
const STABILITY_THRESHOLD = 3;

/**
 * Simple digit recognition using pattern matching
 * This is a lightweight alternative to full Tesseract for numeric displays
 */
function extractDigitsFromImageData(
  _imageData: ImageData,
  vitalType: VitalType
): { text: string; confidence: number } {
  // TODO: Implement actual OCR using Tesseract.js
  // For now, return placeholder - the component will use Tesseract.js directly
  return { text: '', confidence: 0 };
}

/**
 * Parse extracted text into vital reading
 */
function parseVitalText(text: string, vitalType: VitalType): VitalReading | null {
  const normalized = text
    .replace(/[oO]/g, '0')
    .replace(/[lI]/g, '1')
    .replace(/[sS]/g, '5')
    .replace(/\s+/g, ' ')
    .trim();

  switch (vitalType) {
    case 'blood_pressure':
      return parseBloodPressure(normalized);
    case 'glucose':
      return parseGlucose(normalized);
    case 'weight':
      return parseWeight(normalized);
    case 'heart_rate':
      return parseHeartRate(normalized);
    case 'pulse_oximeter':
      return parsePulseOximeter(normalized);
    default:
      return null;
  }
}

function parseBloodPressure(text: string): BloodPressureReading | null {
  // Pattern: "142/86" or "142 / 86"
  const simplePattern = /(\d{2,3})\s*[\/\-]\s*(\d{2,3})/;
  const match = text.match(simplePattern);

  if (match) {
    const sys = parseInt(match[1], 10);
    const dia = parseInt(match[2], 10);

    if (sys >= 70 && sys <= 250 && dia >= 40 && dia <= 150 && sys > dia) {
      // Look for pulse
      const pulsePattern = /(?:pulse|pul|hr|bpm)[:\s]*(\d{2,3})/i;
      const pulseMatch = text.match(pulsePattern);
      const pulse = pulseMatch ? parseInt(pulseMatch[1], 10) : undefined;

      return {
        type: 'blood_pressure',
        systolic: sys,
        diastolic: dia,
        pulse: pulse && pulse >= 30 && pulse <= 220 ? pulse : undefined,
        unit: 'mmHg',
        source: 'camera_scan',
        confidence: 0.8,
      };
    }
  }

  // Pattern: three numbers (SYS, DIA, PUL)
  const threeNumbers = text.match(/(\d{2,3})\D+(\d{2,3})\D+(\d{2,3})/);
  if (threeNumbers) {
    const nums = [
      parseInt(threeNumbers[1], 10),
      parseInt(threeNumbers[2], 10),
      parseInt(threeNumbers[3], 10),
    ].sort((a, b) => b - a);

    const [sys, dia, pulse] = nums;
    if (sys >= 70 && sys <= 250 && dia >= 40 && dia <= 150 && pulse >= 30 && pulse <= 220) {
      return {
        type: 'blood_pressure',
        systolic: sys,
        diastolic: dia,
        pulse,
        unit: 'mmHg',
        source: 'camera_scan',
        confidence: 0.6,
      };
    }
  }

  return null;
}

function parseGlucose(text: string): VitalReading | null {
  const pattern = /(\d{2,3})\s*(?:mg\/?dl)?/i;
  const match = text.match(pattern);

  if (match) {
    const value = parseInt(match[1], 10);
    if (value >= 40 && value <= 600) {
      return {
        type: 'glucose',
        value,
        unit: 'mg/dL',
        source: 'camera_scan',
        confidence: 0.85,
      };
    }
  }
  return null;
}

function parseWeight(text: string): VitalReading | null {
  const pattern = /(\d{2,3}(?:\.\d)?)\s*(?:lbs?|pounds?|kg)?/i;
  const match = text.match(pattern);

  if (match) {
    const value = parseFloat(match[1]);
    if (value >= 50 && value <= 500) {
      return {
        type: 'weight',
        value,
        unit: 'lbs',
        source: 'camera_scan',
        confidence: 0.85,
      };
    }
  }
  return null;
}

function parseHeartRate(text: string): VitalReading | null {
  const pattern = /(\d{2,3})\s*(?:bpm|beats?)?/i;
  const match = text.match(pattern);

  if (match) {
    const value = parseInt(match[1], 10);
    if (value >= 30 && value <= 220) {
      return {
        type: 'heart_rate',
        value,
        unit: 'bpm',
        source: 'camera_scan',
        confidence: 0.85,
      };
    }
  }
  return null;
}

function parsePulseOximeter(text: string): VitalReading | null {
  const pattern = /(?:spo2|o2|sat)?[:\s]*(\d{2,3})\s*%?/i;
  const match = text.match(pattern);

  if (match) {
    const value = parseInt(match[1], 10);
    if (value >= 50 && value <= 100) {
      return {
        type: 'pulse_oximeter',
        value,
        unit: '%',
        source: 'camera_scan',
        confidence: 0.85,
      };
    }
  }
  return null;
}

/**
 * Hook for live camera scanning with client-side OCR
 */
export function useCameraScan(): UseCameraScanResult {
  const [state, setState] = useState<CameraScanState>({
    isScanning: false,
    hasPermission: null,
    error: null,
    lastReading: null,
    confidence: 0,
    rawText: '',
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const vitalTypeRef = useRef<VitalType>('blood_pressure');
  const stableReadingsRef = useRef<VitalReading[]>([]);
  const tesseractWorkerRef = useRef<Worker | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (tesseractWorkerRef.current) {
        tesseractWorkerRef.current.terminate();
      }
    };
  }, []);

  const stopScanning = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setState(prev => ({
      ...prev,
      isScanning: false,
    }));
    stableReadingsRef.current = [];
  }, []);

  const processFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !state.isScanning) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw current frame to canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Get image data for OCR
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Simple digit extraction (placeholder for Tesseract)
    const { text, confidence } = extractDigitsFromImageData(imageData, vitalTypeRef.current);

    if (text && confidence > 0.5) {
      const reading = parseVitalText(text, vitalTypeRef.current);

      if (reading) {
        // Check stability
        stableReadingsRef.current.push(reading);
        if (stableReadingsRef.current.length > STABILITY_THRESHOLD) {
          stableReadingsRef.current.shift();
        }

        // Check if readings are stable (all same values)
        const isStable = stableReadingsRef.current.length >= STABILITY_THRESHOLD &&
          stableReadingsRef.current.every(r => {
            if (r.type === 'blood_pressure' && reading.type === 'blood_pressure') {
              return r.systolic === reading.systolic && r.diastolic === reading.diastolic;
            }
            return r.value === reading.value;
          });

        if (isStable) {
          setState(prev => ({
            ...prev,
            lastReading: reading,
            confidence,
            rawText: text,
          }));
          // Don't auto-stop - let user confirm
        }
      }

      setState(prev => ({
        ...prev,
        rawText: text,
        confidence,
      }));
    }

    // Continue scanning
    if (state.isScanning) {
      animationRef.current = requestAnimationFrame(processFrame);
    }
  }, [state.isScanning]);

  const startScanning = useCallback(async (vitalType: VitalType) => {
    vitalTypeRef.current = vitalType;
    stableReadingsRef.current = [];

    setState(prev => ({
      ...prev,
      isScanning: true,
      error: null,
      lastReading: null,
      rawText: '',
      confidence: 0,
    }));

    try {
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Prefer back camera
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        setState(prev => ({
          ...prev,
          hasPermission: true,
        }));

        // Start frame processing
        // Note: For production, integrate Tesseract.js here
        // For now, we'll use a simple interval-based approach
        const processInterval = setInterval(async () => {
          if (!state.isScanning) {
            clearInterval(processInterval);
            return;
          }
          await processFrame();
        }, 500); // Process every 500ms
      }
    } catch (err: unknown) {
      const error = err as Error;
      let errorMessage = 'Failed to access camera';

      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera permission was denied. Please allow camera access and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera found on this device.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera is being used by another application.';
      }

      setState(prev => ({
        ...prev,
        isScanning: false,
        hasPermission: false,
        error: errorMessage,
      }));
    }
  }, [processFrame, state.isScanning]);

  return {
    state,
    startScanning,
    stopScanning,
    videoRef,
    canvasRef,
  };
}

export default useCameraScan;
