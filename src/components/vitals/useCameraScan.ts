/**
 * useCameraScan Hook
 * Live camera scanning for vital sign displays using Tesseract.js OCR
 * No images are uploaded - all processing happens in browser memory
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import Tesseract, { Worker, createWorker } from 'tesseract.js';
import { VitalReading, VitalType, BloodPressureReading } from './types';
import { auditLogger } from '../../services/auditLogger';

export interface CameraScanState {
  isScanning: boolean;
  hasPermission: boolean | null;
  error: string | null;
  lastReading: VitalReading | null;
  confidence: number;
  rawText: string;
  isInitializing: boolean;
}

export interface UseCameraScanResult {
  state: CameraScanState;
  startScanning: (vitalType: VitalType) => Promise<void>;
  stopScanning: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

// Debounce threshold - readings must be stable for this many consecutive frames
const STABILITY_THRESHOLD = 3;

// OCR scan interval in milliseconds
const SCAN_INTERVAL_MS = 800;

/**
 * Parse extracted text into vital reading
 */
function parseVitalText(text: string, vitalType: VitalType): VitalReading | null {
  // Normalize common OCR mistakes
  const normalized = text
    .replace(/[oO]/g, '0')
    .replace(/[lI|]/g, '1')
    .replace(/[sS]/g, '5')
    .replace(/[Bb]/g, '8')
    .replace(/[Zz]/g, '2')
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
    case 'temperature':
      return parseTemperature(normalized);
    default:
      return null;
  }
}

function parseBloodPressure(text: string): BloodPressureReading | null {
  // Pattern 1: "142/86" or "142 / 86" or "142-86"
  const simplePattern = /(\d{2,3})\s*[\/\-]\s*(\d{2,3})/;
  const match = text.match(simplePattern);

  if (match) {
    let sys = parseInt(match[1], 10);
    let dia = parseInt(match[2], 10);

    // Swap if in wrong order
    if (dia > sys) {
      [sys, dia] = [dia, sys];
    }

    if (sys >= 70 && sys <= 250 && dia >= 40 && dia <= 150 && sys > dia) {
      // Look for pulse
      const pulsePattern = /(?:pulse|pul|hr|bpm|p)[:\s]*(\d{2,3})/i;
      const pulseMatch = text.match(pulsePattern);
      let pulse = pulseMatch ? parseInt(pulseMatch[1], 10) : undefined;

      // Also check for a third number after BP
      if (!pulse) {
        const afterBP = text.slice(text.indexOf(match[0]) + match[0].length);
        const thirdNum = afterBP.match(/(\d{2,3})/);
        if (thirdNum) {
          const val = parseInt(thirdNum[1], 10);
          if (val >= 30 && val <= 220) {
            pulse = val;
          }
        }
      }

      return {
        type: 'blood_pressure',
        systolic: sys,
        diastolic: dia,
        pulse: pulse && pulse >= 30 && pulse <= 220 ? pulse : undefined,
        unit: 'mmHg',
        source: 'camera_scan',
        confidence: 0.85,
      };
    }
  }

  // Pattern 2: Labeled format "SYS 142 DIA 86"
  const labeledSysPattern = /(?:sys|systolic)[:\s]*(\d{2,3})/i;
  const labeledDiaPattern = /(?:dia|diastolic)[:\s]*(\d{2,3})/i;
  const sysMatch = text.match(labeledSysPattern);
  const diaMatch = text.match(labeledDiaPattern);

  if (sysMatch && diaMatch) {
    const sys = parseInt(sysMatch[1], 10);
    const dia = parseInt(diaMatch[1], 10);

    if (sys >= 70 && sys <= 250 && dia >= 40 && dia <= 150) {
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
        confidence: 0.9,
      };
    }
  }

  // Pattern 3: Three numbers (SYS, DIA, PUL) - common on BP monitors
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
        confidence: 0.7,
      };
    }
  }

  return null;
}

function parseGlucose(text: string): VitalReading | null {
  // Pattern: "126" or "126 mg/dL" or "HI" (high) or "LO" (low)
  const pattern = /(\d{2,3})\s*(?:mg\/?dl)?/i;
  const match = text.match(pattern);

  if (match) {
    const value = parseInt(match[1], 10);
    if (value >= 20 && value <= 600) {
      return {
        type: 'glucose',
        value,
        unit: 'mg/dL',
        source: 'camera_scan',
        confidence: 0.85,
      };
    }
  }

  // Check for HI/LO indicators
  if (/\bhi\b/i.test(text)) {
    return {
      type: 'glucose',
      value: 500, // Indicate very high
      unit: 'mg/dL',
      source: 'camera_scan',
      confidence: 0.6,
    };
  }
  if (/\blo\b/i.test(text)) {
    return {
      type: 'glucose',
      value: 40, // Indicate very low
      unit: 'mg/dL',
      source: 'camera_scan',
      confidence: 0.6,
    };
  }

  return null;
}

function parseWeight(text: string): VitalReading | null {
  // Pattern: "185.4" or "185.4 lbs" or "84.2 kg"
  const lbsPattern = /(\d{2,3}(?:\.\d{1,2})?)\s*(?:lbs?|pounds?|lb)/i;
  const kgPattern = /(\d{2,3}(?:\.\d{1,2})?)\s*(?:kg|kilos?|kilogram)/i;
  const plainPattern = /(\d{2,3}(?:\.\d{1,2})?)/;

  const lbsMatch = text.match(lbsPattern);
  if (lbsMatch) {
    const value = parseFloat(lbsMatch[1]);
    if (value >= 50 && value <= 500) {
      return {
        type: 'weight',
        value: Math.round(value * 10) / 10,
        unit: 'lbs',
        source: 'camera_scan',
        confidence: 0.9,
      };
    }
  }

  const kgMatch = text.match(kgPattern);
  if (kgMatch) {
    const kgValue = parseFloat(kgMatch[1]);
    const lbsValue = kgValue * 2.20462;
    if (lbsValue >= 50 && lbsValue <= 500) {
      return {
        type: 'weight',
        value: Math.round(lbsValue * 10) / 10,
        unit: 'lbs',
        source: 'camera_scan',
        confidence: 0.9,
      };
    }
  }

  const plainMatch = text.match(plainPattern);
  if (plainMatch) {
    const value = parseFloat(plainMatch[1]);
    if (value >= 50 && value <= 500) {
      return {
        type: 'weight',
        value: Math.round(value * 10) / 10,
        unit: 'lbs',
        source: 'camera_scan',
        confidence: 0.75,
      };
    }
  }

  return null;
}

function parseHeartRate(text: string): VitalReading | null {
  // Pattern: "78" or "78 bpm" or "HR: 78"
  const labeledPattern = /(?:hr|heart\s*rate|pulse|bpm)[:\s]*(\d{2,3})/i;
  const labeledMatch = text.match(labeledPattern);

  if (labeledMatch) {
    const value = parseInt(labeledMatch[1], 10);
    if (value >= 30 && value <= 220) {
      return {
        type: 'heart_rate',
        value,
        unit: 'bpm',
        source: 'camera_scan',
        confidence: 0.9,
      };
    }
  }

  // Plain number
  const plainPattern = /(\d{2,3})\s*(?:bpm|beats?)?/i;
  const plainMatch = text.match(plainPattern);

  if (plainMatch) {
    const value = parseInt(plainMatch[1], 10);
    if (value >= 30 && value <= 220) {
      return {
        type: 'heart_rate',
        value,
        unit: 'bpm',
        source: 'camera_scan',
        confidence: 0.8,
      };
    }
  }

  return null;
}

function parsePulseOximeter(text: string): VitalReading | null {
  // Pattern: "SpO2 98" or "98%" or "O2: 98"
  const labeledPattern = /(?:spo2|sp02|o2|sat|oxygen)[:\s]*(\d{2,3})\s*%?/i;
  const labeledMatch = text.match(labeledPattern);

  if (labeledMatch) {
    const value = parseInt(labeledMatch[1], 10);
    if (value >= 50 && value <= 100) {
      return {
        type: 'pulse_oximeter',
        value,
        unit: '%',
        source: 'camera_scan',
        confidence: 0.9,
      };
    }
  }

  // Pattern with % sign
  const percentPattern = /(\d{2,3})\s*%/;
  const percentMatch = text.match(percentPattern);

  if (percentMatch) {
    const value = parseInt(percentMatch[1], 10);
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

function parseTemperature(text: string): VitalReading | null {
  // Pattern: "98.6" or "98.6 F" or "37.0 C"
  const fahrenheitPattern = /(\d{2,3}(?:\.\d{1,2})?)\s*(?:°?\s*f|fahrenheit)/i;
  const celsiusPattern = /(\d{2,3}(?:\.\d{1,2})?)\s*(?:°?\s*c|celsius)/i;
  const plainPattern = /(\d{2,3}(?:\.\d{1,2})?)/;

  const fMatch = text.match(fahrenheitPattern);
  if (fMatch) {
    const value = parseFloat(fMatch[1]);
    if (value >= 90 && value <= 110) {
      return {
        type: 'temperature',
        value: Math.round(value * 10) / 10,
        unit: '°F',
        source: 'camera_scan',
        confidence: 0.9,
      };
    }
  }

  const cMatch = text.match(celsiusPattern);
  if (cMatch) {
    const cValue = parseFloat(cMatch[1]);
    const fValue = (cValue * 9/5) + 32;
    if (fValue >= 90 && fValue <= 110) {
      return {
        type: 'temperature',
        value: Math.round(fValue * 10) / 10,
        unit: '°F',
        source: 'camera_scan',
        confidence: 0.9,
      };
    }
  }

  const plainMatch = text.match(plainPattern);
  if (plainMatch) {
    const value = parseFloat(plainMatch[1]);
    // Assume Fahrenheit if in range
    if (value >= 90 && value <= 110) {
      return {
        type: 'temperature',
        value: Math.round(value * 10) / 10,
        unit: '°F',
        source: 'camera_scan',
        confidence: 0.75,
      };
    }
    // Check if Celsius
    if (value >= 32 && value <= 43) {
      const fValue = (value * 9/5) + 32;
      return {
        type: 'temperature',
        value: Math.round(fValue * 10) / 10,
        unit: '°F',
        source: 'camera_scan',
        confidence: 0.7,
      };
    }
  }

  return null;
}

/**
 * Hook for live camera scanning with Tesseract.js OCR
 */
export function useCameraScan(): UseCameraScanResult {
  const [state, setState] = useState<CameraScanState>({
    isScanning: false,
    hasPermission: null,
    error: null,
    lastReading: null,
    confidence: 0,
    rawText: '',
    isInitializing: false,
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vitalTypeRef = useRef<VitalType>('blood_pressure');
  const stableReadingsRef = useRef<VitalReading[]>([]);
  const tesseractWorkerRef = useRef<Worker | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  /**
   * Initialize Tesseract worker
   */
  const initializeTesseract = useCallback(async (): Promise<Worker> => {
    if (tesseractWorkerRef.current) {
      return tesseractWorkerRef.current;
    }

    setState(prev => ({ ...prev, isInitializing: true }));

    try {
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            // Progress updates - could update UI
          }
        },
      });

      // Optimize for numeric displays (medical devices)
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789./-:%°FSPOspoHILOhilo ',
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
      });

      tesseractWorkerRef.current = worker;
      setState(prev => ({ ...prev, isInitializing: false }));

      auditLogger.info('TESSERACT_INIT_SUCCESS', { message: 'OCR worker initialized' });

      return worker;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      auditLogger.error('TESSERACT_INIT_FAILED', error, { source: 'useCameraScan' });
      setState(prev => ({ ...prev, isInitializing: false }));
      throw error;
    }
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
      if (tesseractWorkerRef.current) {
        tesseractWorkerRef.current.terminate().catch(() => {
          // Ignore termination errors on unmount
        });
        tesseractWorkerRef.current = null;
      }
    };
  }, []);

  /**
   * Stop scanning and cleanup
   */
  const stopScanning = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setState(prev => ({
      ...prev,
      isScanning: false,
    }));
    stableReadingsRef.current = [];
    isProcessingRef.current = false;
  }, []);

  /**
   * Process a single frame with OCR
   */
  const processFrame = useCallback(async () => {
    // Prevent concurrent processing
    if (isProcessingRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState !== 4) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isProcessingRef.current = true;

    try {
      // Draw current frame to canvas
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      // Get Tesseract worker
      const worker = await initializeTesseract();

      // Perform OCR on the canvas
      const { data } = await worker.recognize(canvas);
      const ocrText = data.text;
      const ocrConfidence = data.confidence / 100;

      if (ocrText && ocrConfidence > 0.3) {
        const reading = parseVitalText(ocrText, vitalTypeRef.current);

        setState(prev => ({
          ...prev,
          rawText: ocrText.trim(),
          confidence: ocrConfidence,
        }));

        if (reading) {
          // Check stability - need consistent readings
          stableReadingsRef.current.push(reading);
          if (stableReadingsRef.current.length > STABILITY_THRESHOLD) {
            stableReadingsRef.current.shift();
          }

          // Check if readings are stable (all same values)
          const isStable = stableReadingsRef.current.length >= STABILITY_THRESHOLD &&
            stableReadingsRef.current.every(r => {
              if (r.type === 'blood_pressure' && reading.type === 'blood_pressure') {
                const rBP = r as BloodPressureReading;
                const readingBP = reading as BloodPressureReading;
                return rBP.systolic === readingBP.systolic && rBP.diastolic === readingBP.diastolic;
              }
              return r.value === reading.value;
            });

          if (isStable) {
            // Adjust confidence based on stability
            const baseConfidence = reading.confidence ?? 0.7;
            reading.confidence = Math.min(baseConfidence + 0.1, 0.95);

            setState(prev => ({
              ...prev,
              lastReading: reading,
              confidence: reading.confidence ?? 0.8,
            }));

            auditLogger.info('OCR_READING_DETECTED', {
              vitalType: reading.type,
              confidence: reading.confidence,
              source: 'camera_scan'
            });
          }
        }
      }
    } catch (err: unknown) {
      // Don't log every frame error - too noisy
      // Just continue scanning
    } finally {
      isProcessingRef.current = false;
    }
  }, [initializeTesseract]);

  /**
   * Start camera scanning
   */
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
      // Pre-initialize Tesseract worker
      await initializeTesseract();

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

        // Start periodic frame processing
        scanIntervalRef.current = setInterval(() => {
          processFrame();
        }, SCAN_INTERVAL_MS);

        auditLogger.info('CAMERA_SCAN_STARTED', { vitalType });
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
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Camera does not support the required settings.';
      }

      auditLogger.error('CAMERA_SCAN_FAILED', error, { vitalType });

      setState(prev => ({
        ...prev,
        isScanning: false,
        hasPermission: false,
        error: errorMessage,
      }));
    }
  }, [initializeTesseract, processFrame]);

  return {
    state,
    startScanning,
    stopScanning,
    videoRef,
    canvasRef,
  };
}

export default useCameraScan;
