// Memory Lane Trivia - Era-based trivia game for seniors (1950s-1990s)
import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Brain, Clock, Star, Share2, Award, Sparkles } from 'lucide-react';
import { useSupabaseClient, useUser } from '../contexts/AuthContext';
import { useBranding } from '../BrandingContext';
import SmartBackButton from '../components/ui/SmartBackButton';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

interface TriviaQuestion {
  id: string;
  question: string;
  era: string;
  difficulty: 'easy' | 'medium' | 'hard';
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  cognitive_function: string;
  brain_region: string;
}

interface TriviaProgress {
  id?: string;
  correct_answers: number;
  total_questions: number;
  perfect_score: boolean;
  questions_attempted: string[];
}

const POSITIVE_MESSAGES = [
  "Wonderful memory!",
  "You're amazing!",
  "Fantastic recall!",
  "Brilliant!",
  "You're a star!",
  "Incredible!",
  "Outstanding!",
  "Remarkable!",
  "Superb thinking!",
  "You're doing great!",
  "Keep it up!",
  "Excellent work!",
  "You've got this!",
  "Beautiful job!",
  "Way to go!"
];

const MemoryLaneTriviaPage: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const { branding } = useBranding();
  const { width, height } = useWindowSize();

  // State
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answeredCorrectly, setAnsweredCorrectly] = useState<boolean | null>(null);
  const [progress, setProgress] = useState<TriviaProgress>({
    correct_answers: 0,
    total_questions: 5,
    perfect_score: false,
    questions_attempted: []
  });
  const [showConfetti, setShowConfetti] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [trophies, setTrophies] = useState<Array<{ earned_date: string }>>([]);

  const currentQuestion = questions[currentQuestionIndex];

  const loadTriviaGame = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      // Check if already played today
      const today = new Date().toISOString().split('T')[0];
      const { data: existingProgress } = await supabase
        .from('user_trivia_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('play_date', today)
        .maybeSingle();

      if (existingProgress && existingProgress.completed_at) {
        setProgress({
          correct_answers: existingProgress.correct_answers,
          total_questions: existingProgress.total_questions,
          perfect_score: existingProgress.perfect_score,
          questions_attempted: existingProgress.questions_attempted || []
        });
        setGameCompleted(true);
        setLoading(false);
        return;
      }

      // Get today's questions using the database function
      const { data, error } = await supabase.rpc('get_daily_trivia_questions', {
        p_user_id: user.id
      });

      if (error) throw error;

      setQuestions(data || []);

      // Resume progress if exists
      if (existingProgress) {
        setProgress({
          id: existingProgress.id,
          correct_answers: existingProgress.correct_answers,
          total_questions: existingProgress.total_questions,
          perfect_score: existingProgress.perfect_score,
          questions_attempted: existingProgress.questions_attempted || []
        });

        // Find current question index
        const attemptedCount = (existingProgress.questions_attempted || []).length;
        setCurrentQuestionIndex(attemptedCount);
      }
    } catch (error) {

    } finally {
      setLoading(false);
    }
  }, [user?.id, supabase]);

  const loadTrophies = useCallback(async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('user_trivia_trophies')
      .select('earned_date')
      .eq('user_id', user.id)
      .order('earned_date', { ascending: false })
      .limit(30);

    setTrophies(data || []);
  }, [user?.id, supabase]);

  // Load today's questions and progress
  useEffect(() => {
    if (user?.id) {
      loadTriviaGame();
      loadTrophies();
    }
  }, [user?.id, loadTriviaGame, loadTrophies]);

  const handleAnswerSelect = async (answer: 'A' | 'B' | 'C' | 'D') => {
    if (selectedAnswer || !currentQuestion) return;

    setSelectedAnswer(answer);
    const isCorrect = answer === currentQuestion.correct_answer;
    setAnsweredCorrectly(isCorrect);

    // Update progress
    const newProgress = {
      ...progress,
      correct_answers: progress.correct_answers + (isCorrect ? 1 : 0),
      questions_attempted: [...progress.questions_attempted, currentQuestion.id]
    };
    setProgress(newProgress);

    // Save progress to database
    await saveProgress(newProgress, false);

    // Don't auto-advance - wait for user to click Next
  };

  const handleNextQuestion = async () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer(null);
      setAnsweredCorrectly(null);
    } else {
      // Game completed!
      const perfectScore = progress.correct_answers === 5;
      setGameCompleted(true);

      if (perfectScore) {
        setShowConfetti(true);
        await awardTrophy();
        setTimeout(() => setShowConfetti(false), 8000);
      }

      await saveProgress({ ...progress, perfect_score: perfectScore }, true);
    }
  };

  const saveProgress = async (progressData: TriviaProgress, completed: boolean) => {
    if (!user?.id) return;

    const today = new Date().toISOString().split('T')[0];
    const upsertData = {
      user_id: user.id,
      play_date: today,
      questions_attempted: progressData.questions_attempted,
      correct_answers: progressData.correct_answers,
      total_questions: 5,
      perfect_score: progressData.perfect_score,
      ...(completed && { completed_at: new Date().toISOString() })
    };

    await supabase
      .from('user_trivia_progress')
      .upsert(upsertData, {
        onConflict: 'user_id,play_date'
      });
  };

  const awardTrophy = async () => {
    if (!user?.id) return;

    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('user_trivia_trophies')
      .upsert({
        user_id: user.id,
        earned_date: today,
        trophy_type: 'perfect_score'
      }, {
        onConflict: 'user_id,earned_date'
      });

    await loadTrophies();
  };

  const shareScore = async () => {
    // Share to Community Moments
    const scoreText = progress.perfect_score
      ? `🏆 Perfect Score! I got all 5 Memory Lane trivia questions correct today!`
      : `🧠 I answered ${progress.correct_answers} out of 5 Memory Lane trivia questions correctly today!`;

    try {
      await supabase.from('community_moments').insert({
        user_id: user?.id,
        content: scoreText,
        moment_type: 'achievement',
        visibility: 'community'
      });

      alert('Score shared to Community Moments!');
    } catch (error) {

    }
  };

  const getOptionLetter = (index: number): 'A' | 'B' | 'C' | 'D' => {
    return ['A', 'B', 'C', 'D'][index] as 'A' | 'B' | 'C' | 'D';
  };

  const getButtonClass = (optionLetter: string) => {
    const baseClass = "w-full p-4 text-left rounded-xl font-semibold text-lg transition-all duration-300";

    if (!selectedAnswer) {
      return `${baseClass} bg-white text-gray-900 border-[3px] cursor-pointer hover:bg-blue-50`;
    }

    if (optionLetter === currentQuestion.correct_answer) {
      return `${baseClass} border-[3px] text-white`;
    }

    if (optionLetter === selectedAnswer && optionLetter !== currentQuestion.correct_answer) {
      return `${baseClass} border-[3px] border-red-500 bg-red-100 text-red-800`;
    }

    return `${baseClass} border-[3px] border-gray-300 bg-gray-100 opacity-50`;
  };

  const getButtonStyle = (optionLetter: string) => {
    if (!selectedAnswer) {
      return {
        borderColor: branding.primaryColor
      };
    }

    if (optionLetter === currentQuestion.correct_answer) {
      return {
        backgroundColor: branding.secondaryColor,
        borderColor: branding.secondaryColor
      };
    }

    return {};
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: branding.gradient }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 mx-auto mb-4" style={{ borderColor: branding.primaryColor }}></div>
          <p className="text-xl text-white">Loading your daily trivia...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: branding.gradient }}>
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <SmartBackButton label="Back to Dashboard" />
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-6">
          {/* Title */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Brain style={{ color: branding.primaryColor }} size={40} />
              <h1 className="text-4xl font-bold" style={{ color: branding.primaryColor }}>Memory Lane Trivia</h1>
              <Sparkles style={{ color: branding.secondaryColor }} size={40} />
            </div>
            <p className="text-xl text-gray-600">Travel back in time from the 1950s to 1990s!</p>
          </div>

          {/* Progress Bar */}
          {!gameCompleted && (
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Question {currentQuestionIndex + 1} of 5</span>
                <span className="text-sm font-medium" style={{ color: branding.secondaryColor }} role="status" aria-live="polite">{progress.correct_answers} correct</span>
              </div>
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden" role="progressbar" aria-valuenow={currentQuestionIndex + 1} aria-valuemin={1} aria-valuemax={5} aria-label="Question progress">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${((currentQuestionIndex + 1) / 5) * 100}%`,
                    background: `linear-gradient(90deg, ${branding.primaryColor} 0%, ${branding.secondaryColor} 100%)`
                  }}
                />
              </div>
            </div>
          )}

          {/* Game Completed */}
          {gameCompleted ? (
            <div className="text-center space-y-6" role="alert" aria-live="assertive">
              <div className="rounded-xl p-8" style={{ background: `linear-gradient(135deg, ${branding.primaryColor}15 0%, ${branding.secondaryColor}15 100%)` }}>
                {progress.perfect_score ? (
                  <>
                    <Trophy className="mx-auto mb-4" style={{ color: branding.secondaryColor }} size={80} />
                    <h2 className="text-3xl font-bold mb-3" style={{ color: branding.primaryColor }}>Perfect Score!</h2>
                    <p className="text-xl text-gray-700 mb-4">You got all 5 questions correct! You're a Memory Lane champion!</p>
                    <div className="inline-block rounded-lg px-6 py-3" style={{ backgroundColor: `${branding.secondaryColor}15`, border: `2px solid ${branding.secondaryColor}` }}>
                      <p className="text-2xl font-bold" style={{ color: branding.primaryColor }}>Trophy Earned!</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Star className="mx-auto mb-4" style={{ color: branding.secondaryColor }} size={80} />
                    <h2 className="text-3xl font-bold mb-3" style={{ color: branding.primaryColor }}>{POSITIVE_MESSAGES[progress.correct_answers]}</h2>
                    <p className="text-xl text-gray-700 mb-4">You answered {progress.correct_answers} out of 5 questions correctly!</p>
                    <p className="text-lg text-gray-600">Every question helps keep your mind sharp. Come back tomorrow for new questions!</p>
                  </>
                )}
              </div>

              {/* Share Button */}
              <button
                onClick={shareScore}
                aria-label="Share your score to Community Moments"
                className="mx-auto flex items-center gap-2 px-8 py-4 text-white font-bold text-lg rounded-xl transition shadow-lg"
                style={{ background: `linear-gradient(90deg, ${branding.secondaryColor} 0%, ${branding.primaryColor} 100%)` }}
              >
                <Share2 size={24} aria-hidden="true" />
                Share Your Score
              </button>

              {/* Come Back Message */}
              <div className="border-2 rounded-xl p-6" style={{ backgroundColor: `${branding.primaryColor}10`, borderColor: branding.primaryColor }}>
                <Clock className="mx-auto mb-3" style={{ color: branding.primaryColor }} size={40} />
                <p className="text-lg font-semibold" style={{ color: branding.primaryColor }}>Come back tomorrow for 5 new questions!</p>
                <p className="text-gray-700 mt-2">New trivia available every day at midnight</p>
              </div>
            </div>
          ) : currentQuestion ? (
            /* Question Display */
            <div className="space-y-6">
              {/* Era Badge */}
              <div className="flex items-center justify-between">
                <span className="inline-block px-4 py-2 font-bold rounded-full" style={{ backgroundColor: `${branding.primaryColor}15`, color: branding.primaryColor }}>
                  {currentQuestion.era}
                </span>
                <span className={`inline-block px-4 py-2 font-bold rounded-full ${
                  currentQuestion.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                  currentQuestion.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {currentQuestion.difficulty.toUpperCase()}
                </span>
              </div>

              {/* Question */}
              <div className="rounded-xl p-6 border-2" style={{ background: `linear-gradient(135deg, ${branding.primaryColor}10 0%, ${branding.secondaryColor}10 100%)`, borderColor: branding.secondaryColor }}>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{currentQuestion.question}</h2>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Brain size={16} />
                  <span>Training: {currentQuestion.cognitive_function}</span>
                </div>
              </div>

              {/* Answer Options */}
              <div className="space-y-3" role="radiogroup" aria-label="Answer options">
                {['option_a', 'option_b', 'option_c', 'option_d'].map((optionKey, index) => {
                  const optionLetter = getOptionLetter(index);
                  const optionText = currentQuestion[optionKey as keyof TriviaQuestion] as string;
                  return (
                    <button
                      key={optionLetter}
                      onClick={() => handleAnswerSelect(optionLetter)}
                      disabled={selectedAnswer !== null}
                      role="radio"
                      aria-checked={selectedAnswer === optionLetter}
                      aria-label={`Option ${optionLetter}: ${optionText}`}
                      className={getButtonClass(optionLetter)}
                      style={getButtonStyle(optionLetter)}
                    >
                      <span className="font-bold text-xl mr-3" aria-hidden="true">{optionLetter}.</span>
                      {optionText}
                    </button>
                  );
                })}
              </div>

              {/* Feedback */}
              {answeredCorrectly !== null && (
                <div className="space-y-4">
                  <div
                    className="p-6 rounded-xl border-2 text-center"
                    role="alert"
                    aria-live="assertive"
                    style={{
                      backgroundColor: answeredCorrectly ? `${branding.secondaryColor}15` : `${branding.primaryColor}10`,
                      borderColor: answeredCorrectly ? branding.secondaryColor : branding.primaryColor
                    }}
                  >
                    <p
                      className="text-2xl font-bold mb-2"
                      style={{ color: branding.primaryColor }}
                    >
                      {answeredCorrectly ? '✓ Correct!' : POSITIVE_MESSAGES[Math.floor(Math.random() * POSITIVE_MESSAGES.length)]}
                    </p>
                    <p className="text-lg text-gray-700">
                      {!answeredCorrectly && `The correct answer was ${currentQuestion.correct_answer}.`}
                    </p>
                  </div>

                  {/* Next Question Button */}
                  <button
                    onClick={handleNextQuestion}
                    aria-label={currentQuestionIndex < questions.length - 1 ? 'Go to next question' : 'See your results'}
                    className="w-full py-6 text-white font-bold text-2xl rounded-xl transition shadow-lg hover:scale-105"
                    style={{
                      background: `linear-gradient(90deg, ${branding.secondaryColor} 0%, ${branding.primaryColor} 100%)`
                    }}
                  >
                    {currentQuestionIndex < questions.length - 1 ? '➡️ Next Question' : '🏁 See My Results'}
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Trophy Gallery */}
        {trophies.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6" role="region" aria-label="Trophy collection">
            <div className="flex items-center gap-2 mb-4">
              <Award style={{ color: branding.secondaryColor }} size={28} aria-hidden="true" />
              <h3 className="text-2xl font-bold" style={{ color: branding.primaryColor }}>Your Trophy Collection</h3>
            </div>
            <div className="flex flex-wrap gap-3" role="list" aria-label="Perfect score trophies">
              {trophies.map((trophy, index) => (
                <div
                  key={index}
                  role="listitem"
                  aria-label={`Perfect score trophy earned on ${new Date(trophy.earned_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`}
                  className="flex flex-col items-center justify-center w-20 h-20 rounded-xl border-2 shadow-md hover:scale-110 transition-transform"
                  style={{
                    background: `linear-gradient(135deg, ${branding.secondaryColor}15 0%, ${branding.primaryColor}10 100%)`,
                    borderColor: branding.secondaryColor
                  }}
                >
                  <Trophy style={{ color: branding.secondaryColor }} size={32} aria-hidden="true" />
                  <span className="text-xs font-semibold mt-1" style={{ color: branding.primaryColor }}>
                    {new Date(trophy.earned_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-600 mt-4 text-center">
              {trophies.length} perfect {trophies.length === 1 ? 'score' : 'scores'}! Keep up the great work!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemoryLaneTriviaPage;
