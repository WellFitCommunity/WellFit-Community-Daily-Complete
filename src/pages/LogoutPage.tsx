// src/components/LogoutPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LogoutPage: React.FC = () => {
  const navigate = useNavigate();
  const [sec, setSec] = useState(5);

  // 1) Clear storage on mount
  useEffect(() => {
    localStorage.removeItem('wellfitPhone');
    localStorage.removeItem('wellfitPin');
  }, []);

  // 2) Countdown UI
  useEffect(() => {
    if (sec <= 0) return;
    const t = setTimeout(() => setSec(sec - 1), 1000);
    return () => clearTimeout(t);
  }, [sec]);

  // 3) Redirect when countdown finishes
  useEffect(() => {
    const t = setTimeout(() => {
      navigate('/', { replace: true });
    }, 5000);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="p-8 text-center">
      <h2 className="text-2xl mb-4">You’ve been logged out</h2>
      <p>Returning to the Welcome screen in {sec} second{sec !== 1 && 's'}…</p>
    </div>
  );
};

export default LogoutPage;
