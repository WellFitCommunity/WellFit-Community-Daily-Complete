/**
 * SDOH Assessment Component
 * PRAPARE questionnaire for social determinants of health screening
 */

import React, { useState } from 'react';
import { chwService, SDOHData } from '../../services/chwService';

interface SDOHAssessmentProps {
  visitId: string;
  language: 'en' | 'es';
  onComplete: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export const SDOHAssessment: React.FC<SDOHAssessmentProps> = ({
  visitId,
  language,
  onComplete,
  onBack,
  onSkip
}) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [sdohData, setSDOHData] = useState<Partial<SDOHData>>({
    assessed_at: new Date().toISOString()
  });
  const [loading, setLoading] = useState(false);

  const translations = {
    en: {
      title: 'Health & Social Needs',
      skip: 'Skip This Section',
      back: 'Back',
      next: 'Next',
      finish: 'Finish',
      saving: 'Saving...',
      progress: 'Question',
      of: 'of',
      questions: [
        {
          id: 'food_worry',
          question: 'In the past 12 months, have you worried that food would run out before you got money to buy more?',
          type: 'yesno' as const
        },
        {
          id: 'food_insecurity',
          question: 'In the past 12 months, did the food you bought not last and you didn\'t have money to get more?',
          type: 'yesno' as const
        },
        {
          id: 'housing_status',
          question: 'What is your housing situation today?',
          type: 'choice' as const,
          choices: [
            'I have housing',
            'I do not have housing (staying with others, in a hotel, in a shelter, living outside, etc.)',
            'I choose not to answer'
          ]
        },
        {
          id: 'housing_worry',
          question: 'Are you worried about losing your housing?',
          type: 'yesno' as const
        },
        {
          id: 'transportation_barrier',
          question: 'In the past 12 months, has lack of transportation kept you from medical appointments, meetings, work, or from getting things needed for daily living?',
          type: 'yesno' as const
        },
        {
          id: 'utility_shutoff_threat',
          question: 'In the past 12 months, has the electric, gas, oil, or water company threatened to shut off services in your home?',
          type: 'yesno' as const
        },
        {
          id: 'social_isolation_frequency',
          question: 'How often do you feel lonely or isolated from those around you?',
          type: 'choice' as const,
          choices: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always']
        },
        {
          id: 'safety_concerns',
          question: 'In the past year, have you been afraid of your partner or ex-partner?',
          type: 'yesno' as const
        }
      ]
    },
    es: {
      title: 'Necesidades de Salud y Sociales',
      skip: 'Omitir Esta Sección',
      back: 'Atrás',
      next: 'Siguiente',
      finish: 'Finalizar',
      saving: 'Guardando...',
      progress: 'Pregunta',
      of: 'de',
      questions: [
        {
          id: 'food_worry',
          question: 'En los últimos 12 meses, ¿le ha preocupado que se acabe la comida antes de tener dinero para comprar más?',
          type: 'yesno' as const
        },
        {
          id: 'food_insecurity',
          question: 'En los últimos 12 meses, ¿la comida que compró no duró y no tenía dinero para comprar más?',
          type: 'yesno' as const
        },
        {
          id: 'housing_status',
          question: '¿Cuál es su situación de vivienda hoy?',
          type: 'choice' as const,
          choices: [
            'Tengo vivienda',
            'No tengo vivienda (quedándome con otros, en un hotel, en un refugio, viviendo afuera, etc.)',
            'Prefiero no responder'
          ]
        },
        {
          id: 'housing_worry',
          question: '¿Le preocupa perder su vivienda?',
          type: 'yesno' as const
        },
        {
          id: 'transportation_barrier',
          question: 'En los últimos 12 meses, ¿la falta de transporte le ha impedido ir a citas médicas, reuniones, trabajo o conseguir cosas necesarias para la vida diaria?',
          type: 'yesno' as const
        },
        {
          id: 'utility_shutoff_threat',
          question: 'En los últimos 12 meses, ¿la compañía de electricidad, gas, petróleo o agua ha amenazado con cortar los servicios en su hogar?',
          type: 'yesno' as const
        },
        {
          id: 'social_isolation_frequency',
          question: '¿Con qué frecuencia se siente solo o aislado de quienes le rodean?',
          type: 'choice' as const,
          choices: ['Nunca', 'Rara vez', 'A veces', 'A menudo', 'Siempre']
        },
        {
          id: 'safety_concerns',
          question: 'En el último año, ¿ha tenido miedo de su pareja o ex pareja?',
          type: 'yesno' as const
        }
      ]
    }
  };

  const t = translations[language];
  const question = t.questions[currentQuestion];
  const totalQuestions = t.questions.length;
  const progress = ((currentQuestion + 1) / totalQuestions) * 100;

  const handleAnswer = (value: any) => {
    const questionId = question.id as keyof SDOHData;

    if (question.type === 'yesno') {
      setSDOHData(prev => ({
        ...prev,
        [questionId]: value === 'yes'
      }));
    } else if (question.type === 'choice') {
      setSDOHData(prev => ({
        ...prev,
        [questionId]: value
      }));
    }

    // Auto-advance to next question
    setTimeout(() => {
      if (currentQuestion < totalQuestions - 1) {
        setCurrentQuestion(currentQuestion + 1);
      }
    }, 300);
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    } else {
      onBack();
    }
  };

  const handleFinish = async () => {
    setLoading(true);

    try {
      await chwService.recordSDOHAssessment(visitId, sdohData as SDOHData);
      onComplete();
    } catch (err) {
      // Still proceed since we save offline
      setTimeout(() => onComplete(), 1000);
    } finally {
      setLoading(false);
    }
  };

  const isLastQuestion = currentQuestion === totalQuestions - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl p-12">
          <h2 className="text-5xl font-bold text-gray-800 mb-8 text-center">{t.title}</h2>

          {/* Progress bar */}
          <div className="mb-12">
            <div className="flex justify-between text-xl text-gray-600 mb-3">
              <span>{t.progress} {currentQuestion + 1} {t.of} {totalQuestions}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-6">
              <div
                className="bg-green-600 h-6 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Question */}
          <div className="mb-12">
            <p className="text-3xl text-gray-800 leading-relaxed mb-8">
              {question.question}
            </p>

            {question.type === 'yesno' && (
              <div className="space-y-4">
                <button
                  onClick={() => handleAnswer('yes')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-3xl font-bold py-8 px-8 rounded-2xl transition-all transform hover:scale-105"
                >
                  {language === 'en' ? 'Yes' : 'Sí'}
                </button>

                <button
                  onClick={() => handleAnswer('no')}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white text-3xl font-bold py-8 px-8 rounded-2xl transition-all transform hover:scale-105"
                >
                  No
                </button>
              </div>
            )}

            {question.type === 'choice' && question.choices && (
              <div className="space-y-4">
                {question.choices.map((choice, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswer(choice)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-2xl font-bold py-6 px-8 rounded-2xl transition-all transform hover:scale-105 text-left"
                  >
                    {choice}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-6">
            <button
              onClick={handleBack}
              disabled={loading}
              className="flex-1 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-800 text-2xl font-bold py-6 px-8 rounded-2xl transition-all"
            >
              {t.back}
            </button>

            {currentQuestion === 0 && (
              <button
                onClick={onSkip}
                className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white text-2xl font-bold py-6 px-8 rounded-2xl transition-all"
              >
                {t.skip}
              </button>
            )}

            {isLastQuestion && (
              <button
                onClick={handleFinish}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-2xl font-bold py-6 px-8 rounded-2xl transition-all"
              >
                {loading ? t.saving : t.finish}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
