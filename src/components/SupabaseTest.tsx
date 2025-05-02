// src/components/SupabaseTest.tsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const SupabaseTest: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Debug: print which URL we’re calling
    console.log('Supabase URL:', process.env.REACT_APP_SUPABASE_URL);

    const fetchMessage = async () => {
      try {
        const { data, error } = await supabase
          .from('test_messages')
          .select('message')
          .limit(1)
          .single();

        console.log('Supabase response:', { data, error });
        if (error) {
          setError(error.message);
        } else {
          setMessage(data?.message ?? 'no message found');
        }
      } catch (err: any) {
        // Catch network or CORS errors
        console.error('Fetch threw:', err);
        setError(err.message || 'Unknown error');
      }
    };

    fetchMessage();
  }, []);

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Supabase Test</h2>
      {error ? (
        <p style={{ color: 'red' }}>Error: {error}</p>
      ) : message ? (
        <p>Message: {message}</p>
      ) : (
        <p>Loading…</p>
      )}
    </div>
  );
};

export default SupabaseTest;
