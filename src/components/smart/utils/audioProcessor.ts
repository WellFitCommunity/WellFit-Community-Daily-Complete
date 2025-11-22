/**
 * Audio Processing Utilities for SmartScribe
 * Handles MediaRecorder setup, WebSocket connections, and audio streaming
 * This module is lazy-loaded only when recording starts to reduce initial bundle size
 */

import { ProviderVoiceProfile, VoiceLearningService } from '../../../services/voiceLearningService';
import { auditLogger } from '../../../services/auditLogger';

export interface AudioProcessorConfig {
  wsUrl: string;
  voiceProfile: ProviderVoiceProfile | null;
  onTranscript: (text: string, appliedCorrections: number) => void;
  onCodeSuggestion: (data: any) => void;
  onReady: () => void;
  onStatusChange: (status: string) => void;
  onRecordingStateChange: (isRecording: boolean) => void;
  onError: (error: Error) => void;
}

export interface AudioProcessorResult {
  mediaRecorder: MediaRecorder;
  webSocket: WebSocket;
  stream: MediaStream;
}

/**
 * Initialize audio recording with real-time transcription
 * @param config Configuration object with callbacks
 * @returns Audio processing resources (MediaRecorder, WebSocket, stream)
 */
export async function initializeAudioRecording(
  config: AudioProcessorConfig
): Promise<AudioProcessorResult> {
  try {
    config.onStatusChange('Requesting microphone access…');

    // Get audio stream from user's microphone
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    config.onStatusChange('Connecting to server…');

    // Create WebSocket connection for real-time transcription
    const ws = new WebSocket(config.wsUrl);

    ws.onopen = () => {
      config.onStatusChange('🔴 Recording in progress…');
      config.onRecordingStateChange(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'transcript' && data.isFinal) {
          let text = data.text;
          let appliedCount = 0;

          // Apply learned voice corrections if voice profile exists
          if (config.voiceProfile) {
            const result = VoiceLearningService.applyCorrections(text, config.voiceProfile);
            text = result.corrected;
            appliedCount = result.appliedCount;
          }

          config.onTranscript(text, appliedCount);
        } else if (data.type === 'code_suggestion') {
          config.onCodeSuggestion(data);
        } else if (data.type === 'ready') {
          config.onReady();
        }
      } catch {
        // Ignore non-JSON frames
      }
    };

    ws.onerror = (err) => {
      // HIPAA Audit: Log transcription connection failures
      auditLogger.error(
        'SCRIBE_WEBSOCKET_ERROR',
        err instanceof Error ? err : new Error('WebSocket connection failed'),
        {
          component: 'audioProcessor',
          wsUrl: config.wsUrl,
        }
      );
      config.onStatusChange('Connection error');
      config.onError(new Error('WebSocket connection error'));
    };

    ws.onclose = () => {
      config.onRecordingStateChange(false);
      config.onStatusChange('Recording stopped');
    };

    // Create MediaRecorder for audio capture
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus',
    });

    mediaRecorder.ondataavailable = async (e) => {
      if (ws.readyState === WebSocket.OPEN && e.data && e.data.size > 0) {
        // Convert Blob to ArrayBuffer for consistent server handling
        const buf = await e.data.arrayBuffer();
        ws.send(buf);
      }
    };

    // Start recording in 250ms chunks
    mediaRecorder.start(250);

    return {
      mediaRecorder,
      webSocket: ws,
      stream,
    };
  } catch (error: any) {
    const err = error instanceof Error ? error : new Error('Failed to start audio recording');

    // HIPAA Audit: Log medical transcription recording failures
    auditLogger.error('SCRIBE_RECORDING_FAILED', err, {
      component: 'audioProcessor',
      operation: 'initializeAudioRecording',
    });

    config.onStatusChange('Error: ' + (error?.message ?? 'Failed to start'));
    config.onError(err);

    throw err;
  }
}

/**
 * Stop audio recording and clean up resources
 * @param mediaRecorder MediaRecorder instance to stop
 * @param webSocket WebSocket connection to close
 * @param stream MediaStream to stop
 */
export function stopAudioRecording(
  mediaRecorder: MediaRecorder | null,
  webSocket: WebSocket | null,
  stream?: MediaStream
): void {
  try {
    if (mediaRecorder?.state === 'recording') {
      mediaRecorder.stop();
    }

    webSocket?.close();

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  } catch (error) {
    auditLogger.error(
      'SCRIBE_STOP_RECORDING_ERROR',
      error instanceof Error ? error : new Error('Failed to stop recording'),
      {
        component: 'audioProcessor',
        operation: 'stopAudioRecording',
      }
    );
  }
}
