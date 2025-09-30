// src/components/ui/BackButton.tsx
// Smart back button that remembers where you came from
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface BackButtonProps {
  fallbackPath?: string; // Where to go if no history
  label?: string;
  className?: string;
}

const BackButton: React.FC<BackButtonProps> = ({ 
  fallbackPath = '/', 
  label = 'Back',
  className = ''
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    // Check if we have a referrer in location state
    if (location.state && (location.state as any).from) {
      navigate((location.state as any).from);
    } 
    // Try browser history
    else if (window.history.length > 2) {
      navigate(-1);
    } 
    // Fallback to specified path
    else {
      navigate(fallbackPath);
    }
  };

  return (
    <button
      onClick={handleBack}
      className={`inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${className}`}
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
