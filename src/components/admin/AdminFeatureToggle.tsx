import React, { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

type Props = {
  momentId: string;
  isFeatured: boolean;
  onChanged?: (next: boolean) => void;
  onError?: (error: string) => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'minimal';
};

interface DatabaseError extends Error {
  code?: string;
  details?: string;
}

const AdminFeatureToggle: React.FC<Props> = ({ 
  momentId, 
  isFeatured, 
  onChanged, 
  onError,
  size = 'md',
  variant = 'default'
}) => {
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string>('');

  // Clear error when featured status changes (external update)
  React.useEffect(() => {
    if (localError) {
      setLocalError('');
    }
  }, [isFeatured, localError]);

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
      const dbError = error as DatabaseError;
      
      // Handle specific database error codes
      switch (dbError.code) {
        case 'PGRST116':
          return 'Moment not found';
        case '23505':
          return 'Database constraint violation';
        case '42501':
          return 'Insufficient permissions';
        default:
          return dbError.message || 'Update failed';
      }
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    return 'An unexpected error occurred';
  };

  const flip = useCallback(async () => {
    if (busy) return; // Prevent double-clicks
    
    try {
      setBusy(true);
      setLocalError('');
      
      const next = !isFeatured;
      
      const { data, error } = await supabase
        .from('community_moments')
        .update({ is_gallery_high: next })
        .eq('id', momentId)
        .select('id, is_gallery_high')
        .single();
        
      if (error) {
        throw error;
      }

      // Verify the update was successful
      const updatedValue = Boolean(data?.is_gallery_high);
      if (updatedValue !== next) {
        throw new Error('Update verification failed');
      }

      onChanged?.(updatedValue);
      
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setLocalError(errorMessage);
      onError?.(errorMessage);
      
      // Log error for debugging (in development)
      if (import.meta.env.MODE === 'development') {

      }
    } finally {
      setBusy(false);
    }
  }, [momentId, isFeatured, busy, onChanged, onError]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      flip();
    }
  };

  // Size configurations
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  // Style variants
  const getButtonClasses = () => {
    const baseClasses = `
      ${sizeClasses[size]} 
      rounded-lg font-semibold 
      transition-all duration-200 
      focus:outline-hidden focus:ring-2 focus:ring-offset-2
      disabled:cursor-not-allowed disabled:opacity-50
    `.trim().replace(/\s+/g, ' ');

    if (variant === 'minimal') {
      return `${baseClasses} ${
        isFeatured
          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 focus:ring-gray-300'
          : 'bg-blue-50 text-blue-700 hover:bg-blue-100 focus:ring-blue-300'
      }`;
    }

    // Default variant
    return `${baseClasses} ${
      isFeatured
        ? 'bg-[#8cc63f] text-white hover:bg-[#7db335] focus:ring-[#8cc63f] shadow-xs'
        : 'bg-white text-[#003865] border border-[#003865] hover:bg-[#8cc63f] hover:text-white hover:border-[#8cc63f] focus:ring-[#003865] shadow-xs'
    }`;
  };

  const getStatusIcon = () => {
    if (busy) {
      return (
        <svg className="animate-spin h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      );
    }

    if (variant === 'minimal') {
      return isFeatured ? '★' : '☆';
    }

    return null;
  };

  const getButtonText = () => {
    if (busy) return 'Saving…';
    if (variant === 'minimal') return '';
    return isFeatured ? 'Unfeature' : 'Feature';
  };

  const getAriaLabel = () => {
    const action = isFeatured ? 'Remove from featured moments' : 'Add to featured moments';
    const status = busy ? 'Saving changes' : action;
    return status;
  };

  const getTooltipText = () => {
    if (busy) return 'Saving changes...';
    return isFeatured 
      ? 'Click to remove from featured gallery' 
      : 'Click to add to featured gallery';
  };

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={flip}
        onKeyDown={handleKeyDown}
        disabled={busy}
        className={getButtonClasses()}
        aria-label={getAriaLabel()}
        title={getTooltipText()}
        data-featured={isFeatured}
        data-testid={`feature-toggle-${momentId}`}
      >
        <span className="flex items-center justify-center">
          {getStatusIcon()}
          {getButtonText()}
        </span>
      </button>
      
      {localError && (
        <div 
          className="text-red-600 text-xs mt-1 max-w-xs text-center"
          role="alert"
          aria-live="polite"
        >
          {localError}
        </div>
      )}
    </div>
  );
};

export default AdminFeatureToggle;