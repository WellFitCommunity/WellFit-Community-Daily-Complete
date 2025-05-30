import React, { useState, useEffect } from 'react';
import { triviaQuestions, TriviaQuestion } from '../data/triviaQuestions';

// Helper function to shuffle an array
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const TriviaGame: React.FC = () => {
  const [currentQuestions, setCurrentQuestions] = useState<TriviaQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [gamePhase, setGamePhase] = useState<'loading' | 'playing' | 'finished'>('loading');

  const selectDailyQuestions = () => {
    const allEasy = triviaQuestions.filter(q => q.difficulty === 'Easy');
    const allMedium = triviaQuestions.filter(q => q.difficulty === 'Medium');
    const allHard = triviaQuestions.filter(q => q.difficulty === 'Hard');

    const shuffledEasy = shuffleArray(allEasy);
    const shuffledMedium = shuffleArray(allMedium);
    const shuffledHard = shuffleArray(allHard);

    const dailySet = [
      ...shuffledEasy.slice(0, 3),
      ...shuffledMedium.slice(0, 1),
      ...shuffledHard.slice(0, 1),
    ];
    
    // Further shuffle the final set to mix difficulties
    const finalDailySet = shuffleArray(dailySet);

    if (finalDailySet.length >= 1) { // Check if at least one question was selected
      setCurrentQuestions(finalDailySet);
      setCurrentQuestionIndex(0);
      setScore(0);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setFeedbackMessage('');
      setGamePhase('playing');
    } else {
      setFeedbackMessage("Not enough questions available to start the game. Please check back later or contact support.");
      setGamePhase('finished'); 
    }
  };
  
  useEffect(() => {
    selectDailyQuestions();
  }, []);

  const handleAnswerSelect = (answer: string) => {
    if (!showFeedback) { 
        setSelectedAnswer(answer);
    }
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) {
      setFeedbackMessage('Please select an answer first.');
      // Optionally, make this feedback temporary
      // setShowFeedback(true); 
      // setTimeout(() => { setShowFeedback(false); setFeedbackMessage(''); }, 2000);
      return;
    }

    const currentQ = currentQuestions[currentQuestionIndex];
    setShowFeedback(true); // Show feedback immediately
    if (selectedAnswer === currentQ.correctAnswer) {
      setScore(score + 1);
      setFeedbackMessage('Correct! 🎉');
    } else {
      setFeedbackMessage(`Incorrect. The correct answer was: ${currentQ.correctAnswer}`);
    }
  };

  const handleNextQuestion = () => {
    setShowFeedback(false);
    setSelectedAnswer(null);
    setFeedbackMessage(''); // Clear previous feedback
    if (currentQuestionIndex < currentQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setGamePhase('finished');
    }
  };

  const handlePlayAgain = () => {
    setGamePhase('loading');
    selectDailyQuestions(); // Reselect questions
  };

  if (gamePhase === 'loading') {
    return <div className="text-center p-8 text-xl">Loading Trivia Challenge... 🧐</div>;
  }

  if (gamePhase === 'finished') {
    let affirmation = "Great effort today! Every question helps keep your mind sharp. 🧠";
    if (currentQuestions.length > 0 && score === currentQuestions.length) {
        affirmation = "Perfect score! You're a trivia master! 🏆";
    } else if (currentQuestions.length > 0 && score >= currentQuestions.length / 2) {
        affirmation = "Well done! You have a sharp mind! ✨";
    }

    return (
      <div className="max-w-lg mx-auto p-6 bg-white rounded-lg shadow-xl text-center">
        <h2 className="text-3xl font-bold text-wellfit-blue mb-6">Trivia Challenge Finished!</h2>
        {currentQuestions.length > 0 ? (
          <p className="text-2xl mb-4">Your final score: <span className="font-bold text-wellfit-green">{score}</span> out of {currentQuestions.length}</p>
        ) : (
          <p className="text-xl mb-4 text-red-600">{feedbackMessage || "The game could not be loaded."}</p>
        )}
        <p className="text-xl text-gray-700 mb-8">{affirmation}</p>
        <button
            onClick={handlePlayAgain}
            className="w-full py-3 bg-wellfit-orange text-white font-semibold rounded-lg shadow hover:bg-opacity-90 transition"
        >
            Play Again
        </button>
      </div>
    );
  }

  const currentQ = currentQuestions[currentQuestionIndex];
  if (!currentQ) {
    // This case should ideally be handled by the loading/finished states
    return <div className="text-center p-8 text-red-500">Error: No question loaded. Please try refreshing.</div>;
  }

  return (
    <div className="max-w-lg mx-auto p-4 sm:p-6 bg-white rounded-xl shadow-2xl">
      <h1 className="text-2xl sm:text-3xl font-bold text-center text-wellfit-blue mb-2">Daily Trivia Challenge</h1>
      <p className="text-center text-gray-600 mb-1">Question {currentQuestionIndex + 1} of {currentQuestions.length}</p>
      <p className="text-center text-2xl font-semibold text-wellfit-green mb-6">Score: {score}</p>
      
      {gamePhase === 'playing' && (
        <div>
          <div className="mb-5 p-4 bg-gray-100 rounded-lg shadow">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Cognitive Skill: <span className="font-semibold text-wellfit-purple">{currentQ.cognitiveLabel}</span></span>
                <span>Difficulty: <span className="font-semibold text-wellfit-orange">{currentQ.difficulty}</span></span>
            </div>
            <p className="text-xl sm:text-2xl font-medium text-gray-800 text-center">{currentQ.text}</p>
          </div>

          <div className="space-y-3 mb-6">
            {currentQ.options.map((option, index) => {
              const isSelected = selectedAnswer === option;
              const isCorrect = option === currentQ.correctAnswer;
              let buttonClass = 'bg-gray-50 hover:bg-gray-200 border-gray-300'; // Default

              if (showFeedback) {
                if (isCorrect) {
                  buttonClass = 'bg-green-500 text-white border-green-700 ring-2 ring-green-300'; // Correct answer
                } else if (isSelected && !isCorrect) {
                  buttonClass = 'bg-red-500 text-white border-red-700 ring-2 ring-red-300'; // Selected incorrect answer
                } else {
                  buttonClass = 'bg-gray-200 text-gray-500 border-gray-400 opacity-70 cursor-not-allowed'; // Not selected, feedback shown
                }
              } else if (isSelected) {
                buttonClass = 'bg-wellfit-green text-white border-wellfit-dark-green ring-2 ring-wellfit-green'; // Selected, no feedback yet
              }
              
              return (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(option)}
                  className={`w-full text-left p-3.5 rounded-lg border-2 transition-all duration-150 ease-in-out text-base sm:text-lg shadow-sm
                    ${buttonClass}
                  `}
                  disabled={showFeedback}
                >
                  {option}
                </button>
              );
            })}
          </div>

          {feedbackMessage && showFeedback && ( // Ensure feedback message is shown only when showFeedback is true
            <div className={`my-4 p-3 rounded-md text-center font-semibold text-white
              ${feedbackMessage.startsWith('Correct') ? 'bg-green-600' : 'bg-red-600'}
            `}>
              {feedbackMessage}
            </div>
          )}
          
          {!showFeedback && (
            <button
              onClick={handleSubmitAnswer}
              disabled={selectedAnswer === null}
              className="w-full py-3 bg-wellfit-blue text-white font-semibold rounded-lg shadow-md hover:bg-wellfit-dark-blue disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              Submit Answer
            </button>
          )}

          {showFeedback && (
             <button
              onClick={currentQuestionIndex < currentQuestions.length - 1 ? handleNextQuestion : () => setGamePhase('finished')}
              className="w-full py-3 bg-wellfit-orange text-white font-semibold rounded-lg shadow-md hover:bg-opacity-90 transition-colors mt-2"
            >
              {currentQuestionIndex < currentQuestions.length - 1 ? 'Next Question →' : 'View Results'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TriviaGame;
