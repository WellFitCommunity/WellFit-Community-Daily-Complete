// src/components/admin/ApiKeyManager/GenerateKeyForm.tsx
//
// "Generate New API Key" form. Lives in the top of the page above the table.

import React from 'react';

// Small reusable loading spinner — kept here because it's only used by this
// form's submit button. Extracting it further would over-fragment.
const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-6 w-6',
  };

  return (
    <svg
      className={`animate-spin ${sizeClasses[size]} text-current`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

interface GenerateKeyFormProps {
  newOrgName: string;
  setNewOrgName: (v: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  /** Ref to focus on validation failure (kept on the input). */
  orgNameInputRef: React.RefObject<HTMLInputElement | null>;
}

export const GenerateKeyForm: React.FC<GenerateKeyFormProps> = ({
  newOrgName,
  setNewOrgName,
  loading,
  onSubmit,
  orgNameInputRef,
}) => {
  return (
    <form onSubmit={onSubmit} className="bg-gray-50 p-4 rounded-lg mb-6">
      <h3 className="text-lg font-medium mb-3">Generate New API Key</h3>
      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
        <div className="grow">
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="orgName" className="text-sm font-medium text-gray-700">
              Organization Name *
            </label>
            <span
              className={`text-xs ${
                newOrgName.length > 90 ? 'text-red-600 font-semibold' : 'text-gray-500'
              }`}
            >
              {newOrgName.length}/100
            </span>
          </div>
          <input
            ref={orgNameInputRef}
            id="orgName"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            placeholder="Enter organization name"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus-visible:ring-2 focus-visible:ring-[var(--ea-primary)] focus-visible:border-transparent"
            disabled={loading}
            maxLength={100}
            pattern="[a-zA-Z0-9\s\-_.]+"
            title="Only letters, numbers, spaces, hyphens, underscores, and periods allowed"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading || !newOrgName.trim()}
            className="px-6 py-2 bg-[var(--ea-primary)] text-[var(--ea-text-on-primary)] rounded-lg hover:bg-[var(--ea-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--ea-primary)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Generating…</span>
              </>
            ) : (
              <>
                <span>🔑</span>
                <span>Generate</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
};

export { LoadingSpinner };
export default GenerateKeyForm;
