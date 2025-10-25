/**
 * SDOH Assessment Component
 * PRAPARE questionnaire for social determinants of health screening
 * Displays all questions at once for easier completion
 */

import React, { useState, useEffect } from 'react';
import { chwService, SDOHData } from '../../services/chwService';

interface SDOHAssessmentProps {
  visitId: string;
  language: 'en' | 'es';
  onComplete: () => void;
  onBack: () => void;
  onSkip: () => void;
}

type QuestionId = keyof Omit<SDOHData, 'notes' | 'assessed_at'>;

export const SDOHAssessment: React.FC<SDOHAssessmentProps> = ({
  visitId,
  language,
  onComplete,
  onBack,
  onSkip
}) => {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const translations = {
    en: {
      title: 'Social Needs Assessment',
      privacyNotice: 'All information is confidential and protected by HIPAA.',
      confidentialityNote: 'Your answers are confidential and will help us connect you with resources.',
      foodQuestion: 'In the past year, have you worried about food running out before you got money to buy more?',
      foodLastQuestion: 'In the past year, did the food you bought not last and you didn\'t have money to get more?',
      housingQuestion: 'What is your current housing situation?',
      housingWorryQuestion: 'Are you worried about losing your housing?',
      transportQuestion: 'In the past year, has lack of transportation kept you from medical appointments, work, or getting necessities?',
      utilityQuestion: 'In the past year, has a utility company threatened to shut off your service?',
      isolationQuestion: 'How often do you feel lonely or isolated?',
      safetyQuestion: 'Do you feel safe in your current home and relationships?',
      yes: 'Yes',
      no: 'No',
      own: 'I own my home',
      rent: 'I rent',
      temporary: 'Temporary housing (staying with others, hotel, etc.)',
      homeless: 'No stable housing',
      never: 'Never',
      rarely: 'Rarely',
      sometimes: 'Sometimes',
      often: 'Often',
      always: 'Always',
      notesLabel: 'Additional Notes (optional)',
      notesPlaceholder: 'Any additional information you would like to share...',
      riskScore: 'Risk Score',
      highRisk: 'High Risk - Immediate case management needed',
      moderateRisk: 'Moderate Risk - Resources recommended',
      lowRisk: 'Low Risk',
      back: 'Back',
      skip: 'Skip Assessment',
      complete: 'Complete Assessment',
      saving: 'Saving...',
      alimentos: 'Food',
      vivienda: 'Housing',
      transporte: 'Transportation',
      servicios: 'Utilities',
      seguridad: 'Safety'
    },
    es: {
      title: 'Evaluación de Necesidades Sociales',
      privacyNotice: 'Toda la información es confidencial y está protegida por HIPAA.',
      confidentialityNote: 'Sus respuestas son confidenciales y nos ayudarán a conectarlo con recursos.',
      foodQuestion: '¿En el último año, le ha preocupado que se acabe la comida antes de tener dinero para comprar más?',
      foodLastQuestion: '¿En el último año, la comida que compró no duró y no tenía dinero para comprar más?',
      housingQuestion: '¿Cuál es su situación de vivienda actual?',
      housingWorryQuestion: '¿Le preocupa perder su vivienda?',
      transportQuestion: '¿En el último año, la falta de transporte le ha impedido ir a citas médicas, trabajo o conseguir necesidades?',
      utilityQuestion: '¿En el último año, una compañía de servicios públicos ha amenazado con cortar su servicio?',
      isolationQuestion: '¿Con qué frecuencia se siente solo o aislado?',
      safetyQuestion: '¿Se siente seguro en su hogar y relaciones actuales?',
      yes: 'Sí',
      no: 'No',
      own: 'Soy dueño de mi casa',
      rent: 'Alquilo',
      temporary: 'Vivienda temporal (quedándome con otros, hotel, etc.)',
      homeless: 'Sin vivienda estable',
      never: 'Nunca',
      rarely: 'Rara vez',
      sometimes: 'A veces',
      often: 'A menudo',
      always: 'Siempre',
      notesLabel: 'Notas Adicionales (opcional)',
      notesPlaceholder: 'Cualquier información adicional que desee compartir...',
      riskScore: 'Puntuación de Riesgo',
      highRisk: 'Alto Riesgo - Se necesita manejo de casos inmediato',
      moderateRisk: 'Riesgo Moderado - Recursos recomendados',
      lowRisk: 'Bajo Riesgo',
      back: 'Atrás',
      skip: 'Omitir Evaluación',
      complete: 'Completar Evaluación',
      saving: 'Guardando...',
      alimentos: 'Alimentos',
      vivienda: 'Vivienda',
      transporte: 'Transporte',
      servicios: 'Servicios Públicos',
      seguridad: 'Seguridad'
    }
  };

  const t = translations[language];

  const handleAnswer = (questionId: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const calculateRiskScore = (): number => {
    let score = 0;
    if (answers.food_insecurity === true) score += 2;
    if (answers.food_worry === true) score += 1;
    if (answers.housing_worry === true) score += 2;
    if (answers.transportation_barrier === true) score += 1;
    if (answers.utility_shutoff_threat === true) score += 2;
    if (answers.safety_concerns === false) score += 2; // Not feeling safe is high risk
    if (answers.social_isolation_frequency === t.always || answers.social_isolation_frequency === t.often) score += 1;
    return Math.min(score, 10);
  };

  const riskScore = calculateRiskScore();
  const allQuestionsAnswered =
    answers.food_worry !== undefined &&
    answers.food_insecurity !== undefined &&
    answers.housing_status !== undefined &&
    answers.housing_worry !== undefined &&
    answers.transportation_barrier !== undefined &&
    answers.utility_shutoff_threat !== undefined &&
    answers.social_isolation_frequency !== undefined &&
    answers.safety_concerns !== undefined;

  const handleSubmit = async () => {
    if (!allQuestionsAnswered) return;

    setLoading(true);
    setError('');

    try {
      const sdohData: SDOHData = {
        food_worry: answers.food_worry,
        food_insecurity: answers.food_insecurity,
        housing_status: answers.housing_status,
        housing_worry: answers.housing_worry,
        transportation_barrier: answers.transportation_barrier,
        utility_shutoff_threat: answers.utility_shutoff_threat,
        safety_concerns: answers.safety_concerns,
        social_isolation_frequency: answers.social_isolation_frequency,
        notes: notes || undefined,
        assessed_at: new Date().toISOString()
      };

      await chwService.recordSDOHAssessment(visitId, sdohData);
      onComplete();
    } catch (err) {
      setError('Failed to save assessment. Please try again.');
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError('');
    handleSubmit();
  };

  const YesNoButtons = ({ questionId, label }: { questionId: string; label: string }) => {
    const selected = answers[questionId];
    return (
      <div className="mb-8 pb-8 border-b border-gray-200">
        <label className="block text-2xl text-gray-800 mb-4 font-medium">{label}</label>
        <div className="flex gap-4">
          <button
            role="button"
            name="yes"
            onClick={() => handleAnswer(questionId, true)}
            className={`flex-1 text-2xl font-bold py-6 px-8 rounded-xl transition-all ${
              selected === true
                ? 'bg-blue-600 text-white selected'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {t.yes}
          </button>
          <button
            role="button"
            name="no"
            onClick={() => handleAnswer(questionId, false)}
            className={`flex-1 text-2xl font-bold py-6 px-8 rounded-xl transition-all ${
              selected === false
                ? 'bg-blue-600 text-white selected'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {t.no}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl p-12">
          <h2 className="text-5xl font-bold text-gray-800 mb-6 text-center">{t.title}</h2>

          {/* Privacy Notice */}
          <div className="mb-8 bg-blue-50 border-2 border-blue-200 px-6 py-4 rounded-xl">
            <p className="text-xl text-blue-900 text-center font-medium">
              {t.privacyNotice}
            </p>
            <p className="text-lg text-blue-800 text-center mt-2">
              {t.confidentialityNote}
            </p>
          </div>

          {/* Offline Mode Indicator */}
          {isOffline && (
            <div className="mb-8 bg-yellow-100 border-2 border-yellow-400 text-yellow-800 px-6 py-4 rounded-xl text-xl">
              <strong>Offline Mode</strong>
            </div>
          )}

          <div className="space-y-6">
            {/* Food Questions */}
            <div className="bg-green-50 p-6 rounded-xl">
              <h3 className="text-3xl font-bold text-green-900 mb-6">{t.alimentos}</h3>
              <YesNoButtons
                questionId="food_worry"
                label={t.foodQuestion}
              />
              <YesNoButtons
                questionId="food_insecurity"
                label={t.foodLastQuestion}
              />
            </div>

            {/* Housing Questions */}
            <div className="bg-purple-50 p-6 rounded-xl">
              <h3 className="text-3xl font-bold text-purple-900 mb-6">{t.vivienda}</h3>

              {/* Housing Status */}
              <div className="mb-8 pb-8 border-b border-purple-200">
                <label className="block text-2xl text-gray-800 mb-4 font-medium">{t.housingQuestion}</label>
                <div className="space-y-3">
                  {[
                    { value: 'own', label: t.own },
                    { value: 'rent', label: t.rent },
                    { value: 'temporary', label: t.temporary },
                    { value: 'homeless', label: t.homeless }
                  ].map(option => (
                    <button
                      key={option.value}
                      role="button"
                      onClick={() => handleAnswer('housing_status', option.value)}
                      className={`w-full text-left text-xl font-bold py-5 px-6 rounded-xl transition-all ${
                        answers.housing_status === option.value
                          ? 'bg-purple-600 text-white selected'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <YesNoButtons
                questionId="housing_worry"
                label={t.housingWorryQuestion}
              />
            </div>

            {/* Transportation */}
            <div className="bg-blue-50 p-6 rounded-xl">
              <h3 className="text-3xl font-bold text-blue-900 mb-6">{t.transporte}</h3>
              <YesNoButtons
                questionId="transportation_barrier"
                label={t.transportQuestion}
              />
            </div>

            {/* Utilities */}
            <div className="bg-yellow-50 p-6 rounded-xl">
              <h3 className="text-3xl font-bold text-yellow-900 mb-6">{t.servicios}</h3>
              <YesNoButtons
                questionId="utility_shutoff_threat"
                label={t.utilityQuestion}
              />
            </div>

            {/* Social Isolation */}
            <div className="bg-indigo-50 p-6 rounded-xl">
              <div className="mb-8">
                <label className="block text-2xl text-gray-800 mb-4 font-medium">{t.isolationQuestion}</label>
                <div className="space-y-3">
                  {[t.never, t.rarely, t.sometimes, t.often, t.always].map(option => (
                    <button
                      key={option}
                      role="button"
                      onClick={() => handleAnswer('social_isolation_frequency', option)}
                      className={`w-full text-left text-xl font-bold py-5 px-6 rounded-xl transition-all ${
                        answers.social_isolation_frequency === option
                          ? 'bg-indigo-600 text-white selected'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Safety */}
            <div className="bg-red-50 p-6 rounded-xl">
              <h3 className="text-3xl font-bold text-red-900 mb-6">{t.seguridad}</h3>
              <YesNoButtons
                questionId="safety_concerns"
                label={t.safetyQuestion}
              />
            </div>

            {/* Risk Score Display */}
            {allQuestionsAnswered && (
              <div className={`p-6 rounded-xl text-center ${
                riskScore >= 7 ? 'bg-red-100 border-2 border-red-500' :
                riskScore >= 4 ? 'bg-yellow-100 border-2 border-yellow-500' :
                'bg-green-100 border-2 border-green-500'
              }`}>
                <p className="text-2xl font-bold mb-2">{t.riskScore}: {riskScore}/10</p>
                <p className="text-xl">
                  {riskScore >= 7 ? t.highRisk : riskScore >= 4 ? t.moderateRisk : t.lowRisk}
                </p>
              </div>
            )}

            {/* Notes Field */}
            <div>
              <label htmlFor="sdoh-notes" className="block text-2xl font-medium text-gray-800 mb-4">
                {t.notesLabel}
              </label>
              <textarea
                id="sdoh-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xl px-6 py-4 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-200 outline-none"
                placeholder={t.notesPlaceholder}
                rows={4}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-100 border-4 border-red-400 text-red-800 px-6 py-4 rounded-xl text-xl">
                <p className="font-bold mb-2">Failed to save assessment</p>
                <p>{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-6 pt-8">
              <button
                onClick={onBack}
                disabled={loading}
                className="flex-1 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-800 text-2xl font-bold py-6 px-8 rounded-2xl transition-all"
              >
                {t.back}
              </button>

              {error ? (
                <button
                  onClick={handleRetry}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-2xl font-bold py-6 px-8 rounded-2xl transition-all"
                >
                  Retry
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!allQuestionsAnswered || loading}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-2xl font-bold py-6 px-8 rounded-2xl transition-all"
                >
                  {loading ? t.saving : t.complete}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
