// src/components/ui/BackButton.tsx
// Simple back button - uses browser history first, then fallback
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface BackButtonProps {
  fallbackPath?: string; // Where to go if no history
  label?: string;
  className?: string;
}

const BackButton: React.FC<BackButtonProps> = ({
  fallbackPath = '/dashboard',
  label = 'Back',
  className = ''
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    // Check if we have explicit "from" state passed during navigation
    const state = location.state as { from?: string } | null;
    if (state?.from) {
      navigate(state.from);
      return;
    }

    // Try browser history if we have meaningful history
    if (window.history.length > 2) {
      navigate(-1);
      return;
    }

    // Fallback to specified path
    navigate(fallbackPath);
  };

  return (
    <button
      onClick={handleBack}
      className={`inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${className}`}
      aria-label={label}
    >
      <svg 
        className="w-4 h-4 mr-2" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M10 19l-7-7m0 0l7-7m-7 7h18" 
        />
      </svg>
      {label}
    </button>
  );
};

export default BackButton;
