/**
 * Recording Button Component
 *
 * Start/Stop recording button for Compass Riley.
 * Split from RealTimeSmartScribe for better performance.
 */

import React from 'react';
import { EAButton } from '../envision-atlus/EAButton';

interface RecordingButtonProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export const RecordingButton: React.FC<RecordingButtonProps> = React.memo(({
  isRecording,
  onStartRecording,
  onStopRecording,
}) => {
  return (
    <div className="flex justify-center py-4">
      {!isRecording ? (
        <EAButton
          variant="accent"
          size="lg"
          onClick={onStartRecording}
          icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="6" />
            </svg>
          }
          className="px-8 py-4 text-lg"
        >
          Start Recording Visit
        </EAButton>
      ) : (
        <EAButton
          variant="secondary"
          size="lg"
          onClick={onStopRecording}
          icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <rect x="5" y="5" width="10" height="10" rx="1" />
            </svg>
          }
          className="px-8 py-4 text-lg"
        >
          Stop Recording
        </EAButton>
      )}
    </div>
  );
});

RecordingButton.displayName = 'RecordingButton';

export default RecordingButton;
