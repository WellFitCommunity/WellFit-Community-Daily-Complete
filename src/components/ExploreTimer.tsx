import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ✅ Tell TypeScript what prop you're expecting
interface ExploreTimerProps {
  minutes: number;
}

const ExploreTimer: React.FC<ExploreTimerProps> = ({ minutes }) => {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) {
      alert('Your 15-minute preview has ended. Please complete enrollment to continue.');
      navigate('/senior-enrollment');
    }
  }, [secondsLeft, navigate]);

  const displayMinutes = Math.floor(secondsLeft / 60);
  const displaySeconds = secondsLeft % 60;

  return (
    <div className="bg-yellow-100 text-gray-800 p-3 text-sm rounded shadow-md mb-4 text-center">
      <p>
        You have {displayMinutes}:{displaySeconds.toString().padStart(2, '0')} minutes to explore the app.
      </p>
      <p>You’ll be redirected back to enrollment when time is up.</p>
      <button
        className="mt-2 px-3 py-1 bg-wellfit-blue text-white rounded hover:bg-wellfit-green transition"
        onClick={() => navigate('/senior-enrollment')}
      >
        Back to Enrollment Now
      </button>
    </div>
  );
};

export default ExploreTimer;
