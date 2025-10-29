import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { triviaQuestions, TriviaQuestion } from '../data/triviaQuestions';
import { useSupabaseClient, useUser } from '../contexts/AuthContext';
import { saveTriviaGameResult } from '../services/engagementTracking';

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
  const navigate = useNavigate();
  const supabase = useSupabaseClient();
  const user = useUser();
  const [currentQuestions, setCurrentQuestions] = useState<TriviaQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [gamePhase, setGamePhase] = useState<'loading' | 'playing' | 'finished'>('loading');
  const [gamesPlayedToday, setGamesPlayedToday] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [completionTime, setCompletionTime] = useState<number | null>(null);

  const LOCAL_STORAGE_KEY = 'dailyTriviaSet';
  const GAMES_PLAYED_KEY = 'memoryLaneGamesPlayed';
  const TIME_TRACKING_KEY = 'memoryLaneTimeTracking';

  interface StoredTriviaSet {
    date: string;
    questionIds: string[];
  }

  const selectDailyQuestions = () => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    let dailyQuestions: TriviaQuestion[] = [];

    try {
      const storedSetString = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedSetString) {
        const storedSet = JSON.parse(storedSetString) as StoredTriviaSet;
        if (storedSet.date === today && storedSet.questionIds.length > 0) {
          // Try to find questions from the main list based on stored IDs
          const foundQuestions = storedSet.questionIds.map(id =>
            triviaQuestions.find(q => q.id === id)
          ).filter(q => q !== undefined) as TriviaQuestion[];

          if (foundQuestions.length === storedSet.questionIds.length) {
            dailyQuestions = shuffleArray(foundQuestions); // Shuffle the selected daily set
          }
        }
      }
    } catch (error) {
      // console.error("Error reading daily trivia from localStorage:", error);
      // Proceed to select new questions if localStorage is corrupt or inaccessible
    }

    if (dailyQuestions.length === 0) { // No valid set from localStorage, or it's a new day
      const allEasy = triviaQuestions.filter(q => q.difficulty === 'Easy');
      const allMedium = triviaQuestions.filter(q => q.difficulty === 'Medium');
      const allHard = triviaQuestions.filter(q => q.difficulty === 'Hard');

      const shuffledEasy = shuffleArray(allEasy);
      const shuffledMedium = shuffleArray(allMedium);
      const shuffledHard = shuffleArray(allHard);

      // Ensure enough questions are available before slicing
      const selectedEasy = shuffledEasy.slice(0, 3); // Default 3 Easy
      const selectedMedium = shuffledMedium.slice(0, 1); // Default 1 Medium
      const selectedHard = shuffledHard.slice(0, 1); // Default 1 Hard

      const newDailySet = [
        ...selectedEasy,
        ...selectedMedium,
        ...selectedHard,
      ];

      dailyQuestions = shuffleArray(newDailySet); // Shuffle the final combined set

      if (dailyQuestions.length > 0) {
        const questionIds = dailyQuestions.map(q => q.id);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ date: today, questionIds }));
      }
    }

    if (dailyQuestions.length >= 1) {
      setCurrentQuestions(dailyQuestions);
      setCurrentQuestionIndex(0);
      setScore(0);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setFeedbackMessage('');
      setGamePhase('playing');
      setStartTime(Date.now()); // Start tracking time
      setCompletionTime(null);
    } else {
      setFeedbackMessage("Not enough questions available to start the game. Please check back later or contact support.");
      setGamePhase('finished'); 
    }
  };
  
  useEffect(() => {
    selectDailyQuestions();
    checkGamesPlayedToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkGamesPlayedToday = () => {
    const today = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem(GAMES_PLAYED_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      if (data.date === today) {
        setGamesPlayedToday(data.count || 0);
      } else {
        setGamesPlayedToday(0);
        localStorage.setItem(GAMES_PLAYED_KEY, JSON.stringify({ date: today, count: 0 }));
      }
    } else {
      localStorage.setItem(GAMES_PLAYED_KEY, JSON.stringify({ date: today, count: 0 }));
    }
  };

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

  const handleNextQuestion = async () => {
    setShowFeedback(false);
    setSelectedAnswer(null);
    setFeedbackMessage(''); // Clear previous feedback
    if (currentQuestionIndex < currentQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Calculate completion time
      if (startTime) {
        const timeInSeconds = Math.round((Date.now() - startTime) / 1000);
        setCompletionTime(timeInSeconds);

        // Save time tracking to localStorage
        try {
          const today = new Date().toISOString().split('T')[0];
          const stored = localStorage.getItem(TIME_TRACKING_KEY);
          let timeData: any = {};

          if (stored) {
            timeData = JSON.parse(stored);
          }

          if (!timeData[today]) {
            timeData[today] = [];
          }

          timeData[today].push({
            timestamp: new Date().toISOString(),
            completionTime: timeInSeconds,
            score: score,
            totalQuestions: currentQuestions.length
          });

          localStorage.setItem(TIME_TRACKING_KEY, JSON.stringify(timeData));
        } catch (error) {
          // console.error('Failed to save time tracking:', error);
        }

        // ✅ SAVE TO DATABASE (the fix!)
        if (user?.id) {
          try {
            // Calculate difficulty breakdown
            const difficultyBreakdown: Record<string, number> = {};
            currentQuestions.forEach(q => {
              difficultyBreakdown[q.difficulty] = (difficultyBreakdown[q.difficulty] || 0) + 1;
            });

            await saveTriviaGameResult(supabase, {
              user_id: user.id,
              started_at: new Date(startTime).toISOString(),
              completed_at: new Date().toISOString(),
              completion_time_seconds: timeInSeconds,
              score: score,
              total_questions: currentQuestions.length,
              difficulty_breakdown: difficultyBreakdown,
              questions_attempted: currentQuestions.map(q => q.id),
              completion_status: 'completed'
            });
            // console.log('✅ Trivia game result saved to database');
          } catch (error) {
            // console.error('Failed to save trivia result to database:', error);
          }
        }
      }
      setGamePhase('finished');
    }
  };

  const handlePlayAgain = () => {
    setGamePhase('loading'); // Show loading while questions are (re)selected
    setCompletionTime(null);
    selectDailyQuestions(); // This will load the same daily set if called on the same day
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  if (gamePhase === 'loading') {
    return (
      <div className="min-h-screen" style={{
        background: 'linear-gradient(to bottom right, #003865, #8cc63f)'
      }}>
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="text-center p-8 text-xl bg-white rounded-xl shadow-lg max-w-lg mx-auto">
            Loading Memory Lane... 🎭
          </div>
        </div>
      </div>
    );
  }

  if (gamePhase === 'finished') {
    let affirmation = "Great effort today! Every question helps keep your mind sharp. 🧠";
    if (currentQuestions.length > 0 && score === currentQuestions.length) {
        affirmation = "Perfect score! You're a trivia master! 🏆";
    } else if (currentQuestions.length > 0 && score >= currentQuestions.length / 2) {
        affirmation = "Well done! You have a sharp mind! ✨";
    }

    return (
      <div className="min-h-screen" style={{
        background: 'linear-gradient(to bottom right, #003865, #8cc63f)'
      }}>
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="max-w-lg mx-auto p-6 bg-white rounded-lg shadow-xl text-center">
            <h2 className="text-3xl font-bold text-wellfit-blue mb-6">Memory Lane Complete!</h2>
        {currentQuestions.length > 0 ? (
          <>
            <p className="text-2xl mb-4">Your final score: <span className="font-bold text-wellfit-green">{score}</span> out of {currentQuestions.length}</p>
            {completionTime !== null && (
              <p className="text-lg text-gray-600 mb-4">
                Completion time: <span className="font-semibold text-wellfit-blue">{formatTime(completionTime)}</span>
              </p>
            )}
          </>
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
        </div>
      </div>
    );
  }

  const currentQ = currentQuestions[currentQuestionIndex];
  if (!currentQ) {
    // This case should ideally be handled by the loading/finished states
    return <div className="text-center p-8 text-red-500">Error: No question loaded. Please try refreshing.</div>;
  }

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(to bottom right, #003865, #8cc63f)'
    }}>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="max-w-lg mx-auto p-4 sm:p-6 bg-white rounded-xl shadow-2xl">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-[#8cc63f] hover:underline mb-4"
            aria-label="Go back to dashboard"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-center text-wellfit-blue mb-2">Memory Lane</h1>
      <p className="text-center text-gray-600 mb-1">Question {currentQuestionIndex + 1} of {currentQuestions.length}</p>
      <p className="text-center text-xl sm:text-2xl font-semibold text-wellfit-green mb-6">Score: {score}</p>
      
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
              onClick={currentQuestionIndex < currentQuestions.length - 1 ? handleNextQuestion : () => {
                setGamePhase('finished');
                const today = new Date().toISOString().split('T')[0];
                const newCount = gamesPlayedToday + 1;
                setGamesPlayedToday(newCount);
                localStorage.setItem(GAMES_PLAYED_KEY, JSON.stringify({ date: today, count: newCount }));
              }}
              className="w-full py-3 bg-wellfit-orange text-white font-semibold rounded-lg shadow-md hover:bg-opacity-90 transition-colors mt-2"
            >
              {currentQuestionIndex < currentQuestions.length - 1 ? 'Next Question →' : 'View Results'}
            </button>
          )}
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default TriviaGame;
