// Positive Affirmations Widget for Senior Dashboard
import React, { useState, useEffect } from 'react';

const affirmations = [
  "You are valued and loved.",
  "Every day brings new opportunities for joy.",
  "Your wisdom and experience are precious gifts.",
  "You have the strength to handle whatever comes your way.",
  "You make a difference in the lives of others.",
  "Today is full of possibilities.",
  "You are exactly where you need to be.",
  "Your kindness brightens the world.",
  "You are worthy of care and respect.",
  "Each moment is a fresh start.",
  "You have so much to be grateful for.",
  "Your life has meaning and purpose.",
  "You are capable of amazing things.",
  "You deserve happiness and peace.",
  "Your heart is full of love to share."
];

const PositiveAffirmations: React.FC = () => {
  const [currentAffirmation, setCurrentAffirmation] = useState('');

  useEffect(() => {
    // Get daily affirmation based on date
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    const affirmationIndex = dayOfYear % affirmations.length;
    setCurrentAffirmation(affirmations[affirmationIndex]);
  }, []);

  const getNewAffirmation = () => {
    const randomIndex = Math.floor(Math.random() * affirmations.length);
    setCurrentAffirmation(affirmations[randomIndex]);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
      <div className="text-center">
        <div className="text-2xl sm:text-3xl mb-3">✨</div>
        <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-3">
          Daily Affirmation
        </h3>
        <p className="text-base sm:text-lg text-gray-700 mb-4 italic">
          "{currentAffirmation}"
        </p>
        <button
          onClick={getNewAffirmation}
          className="bg-purple-600 text-white text-sm sm:text-base px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          💝 New Affirmation
        </button>
      </div>
    </div>
  );
};

export default PositiveAffirmations;