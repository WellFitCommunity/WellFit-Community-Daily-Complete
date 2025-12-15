// Environment debugging component for development
import React from 'react';

export const EnvironmentDebug: React.FC = () => {
  const envVars = {
    'VITE_ANTHROPIC_API_KEY': import.meta.env.VITE_ANTHROPIC_API_KEY ?
      `${import.meta.env.VITE_ANTHROPIC_API_KEY.substring(0, 7)}...` : 'NOT SET',
    'NODE_ENV': import.meta.env.MODE,
    'VITE_SUPABASE_URL': import.meta.env.VITE_SUPABASE_URL ? 'SET' : 'NOT SET',
    'VITE_SB_ANON_KEY': import.meta.env.VITE_SB_ANON_KEY ? 'SET' : 'NOT SET',
  };

  if (import.meta.env.MODE === 'production') {
    return null; // Don't show in production
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded-lg shadow-lg text-xs max-w-sm z-50">
      <h4 className="font-bold mb-2">Environment Debug</h4>
      <div className="space-y-1">
        {Object.entries(envVars).map(([key, value]) => (
          <div key={key} className="flex justify-between">
            <span className="text-gray-300">{key}:</span>
            <span className={value !== 'NOT SET' ? 'text-green-400' : 'text-red-400'}>
              {value}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-gray-600 text-xs text-gray-400">
        {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
};

export default EnvironmentDebug;