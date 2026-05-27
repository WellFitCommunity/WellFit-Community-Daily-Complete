// src/components/admin/ApiKeyManager/KeyDisplayModal.tsx
//
// One-time display of a freshly-generated API key. The key is auto-masked
// after a short timeout and cannot be retrieved again, so this acts as the
// user's only opportunity to copy it.

import React from 'react';

interface KeyDisplayModalProps {
  /** The plaintext API key to display. `null` hides the panel entirely. */
  generatedKey: string | null;
  /** True after the auto-mask timeout has fired. */
  keyMasked: boolean;
  /** Copy the visible key text to the clipboard. */
  onCopy: (text: string) => void;
  /** Dismiss the panel (called when the user clicks "Dismiss" after masking). */
  onDismiss: () => void;
  /** Ref applied to the outer container for scrollIntoView on success. */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export const KeyDisplayModal: React.FC<KeyDisplayModalProps> = ({
  generatedKey,
  keyMasked,
  onCopy,
  onDismiss,
  containerRef,
}) => {
  if (!generatedKey) return null;

  return (
    <div
      ref={containerRef}
      className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg"
    >
      <div className="flex items-center space-x-2 mb-2">
        <span className="text-green-700 font-medium">🎉 New API Key Generated!</span>
      </div>
      <div className="bg-white p-3 rounded-sm border font-mono text-sm break-all select-all">
        {keyMasked ? '••••••••••••••••••••••••••••••••••••••••' : generatedKey}
      </div>
      <div className="flex justify-between items-center mt-3">
        <p className="text-green-700 text-sm">
          {keyMasked
            ? '🔒 Key has been masked for security. It cannot be retrieved again.'
            : '⚠️ COPY THIS KEY NOW! It will be auto-masked in 5 seconds and cannot be retrieved again.'}
        </p>
        {!keyMasked && (
          <button
            onClick={() => onCopy(generatedKey)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-1"
          >
            <span>📋</span>
            <span>Copy Key</span>
          </button>
        )}
        {keyMasked && (
          <button
            onClick={onDismiss}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-1"
          >
            <span>✕</span>
            <span>Dismiss</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default KeyDisplayModal;
