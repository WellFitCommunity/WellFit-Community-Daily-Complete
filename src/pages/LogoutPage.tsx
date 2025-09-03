// src/components/LogoutPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseClient } from '../lib/supabaseClient';

const LogoutPage: React.FC = () => {
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const [sec, setSec] = useState(5);

  useEffect(() => {
    // Clear Supabase + custom local keys
    supabase.auth.signOut();
    localStorage.removeItem('wellfitPhone');
    localStorage.removeItem('wellfitPin');
  }, [supabase]);

  useEffect(() => {
    if (sec <= 0) {
      navigate('/', { replace: true });
      return;
    }
    const t = setTimeout(() => setSec(sec - 1), 1000);
    return () => clearTimeout(t);
  }, [sec, navigate]);

  return (
    <div className="p-8 text-center">
      <h2 className="text-2xl mb-4">You’ve been logged out</h2>
      <p role="status" aria-live="polite">
        Returning to the Welcome screen in {sec} second{sec !== 1 && 's'}…
      </p>
    </div>
  );
};

export default LogoutPage;

