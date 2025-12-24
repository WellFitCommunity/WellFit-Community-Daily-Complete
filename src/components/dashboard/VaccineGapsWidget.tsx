import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FHIRService from '../../services/fhirResourceService';
import { useAuth } from '../../contexts/AuthContext';

interface VaccineGap {
  vaccine_code: string;
  vaccine_name: string;
  last_received_date: string | null;
  months_since_last: number | null;
  recommendation: string;
}

const VaccineGapsWidget: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [gaps, setGaps] = useState<VaccineGap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadVaccineGaps();
    }
  }, [user?.id]);

  const loadVaccineGaps = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const result = await FHIRService.Immunization.getVaccineGaps(user.id);
      if (result.success && Array.isArray(result.data)) {
        setGaps(result.data.slice(0, 3)); // Show top 3 gaps
      }
    } catch (error) {

    }
    setLoading(false);
  };

  const getVaccineIcon = (vaccineName: string) => {
    if (vaccineName.toLowerCase().includes('influenza') || vaccineName.toLowerCase().includes('flu')) return '💉';
    if (vaccineName.toLowerCase().includes('covid')) return '🦠';
    if (vaccineName.toLowerCase().includes('shingles') || vaccineName.toLowerCase().includes('zoster')) return '🛡️';
    if (vaccineName.toLowerCase().includes('pneumococcal')) return '🫁';
    if (vaccineName.toLowerCase().includes('tetanus') || vaccineName.toLowerCase().includes('tdap')) return '💪';
    return '💉';
  };

  const getPriorityColor = (monthsSinceLast: number | null) => {
    if (monthsSinceLast === null) return 'border-yellow-400 bg-yellow-50';
    if (monthsSinceLast >= 24) return 'border-red-400 bg-red-50';
    if (monthsSinceLast >= 12) return 'border-orange-400 bg-orange-50';
    return 'border-yellow-400 bg-yellow-50';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">⚠️ Vaccine Care Gaps</h3>
        </div>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-xs border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">⚠️ Vaccine Care Gaps</h3>
        {gaps.length > 0 && (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
            {gaps.length}
          </span>
        )}
      </div>

      {gaps.length === 0 ? (
        <div className="text-center py-8">
          <span className="text-4xl mb-2 block">✅</span>
          <p className="text-sm font-medium text-green-900 mb-1">All Caught Up!</p>
          <p className="text-xs text-green-700">
            You're up-to-date with recommended vaccines
          </p>
          <button
            onClick={() => navigate('/immunizations')}
            className="mt-4 text-sm text-purple-600 hover:text-purple-700 font-medium"
          >
            View Immunization Records →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {gaps.map((gap, index) => (
            <div
              key={index}
              className={`border-l-4 ${getPriorityColor(gap.months_since_last)} rounded-r-lg p-3 hover:shadow-md transition-shadow cursor-pointer`}
              onClick={() => navigate('/immunizations')}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">{getVaccineIcon(gap.vaccine_name)}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 truncate">
                    {gap.vaccine_name}
                  </h4>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                    {gap.recommendation}
                  </p>
                  {gap.last_received_date && gap.months_since_last !== null && (
                    <p className="text-xs text-gray-500 mt-1">
                      Last: {new Date(gap.last_received_date).toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric'
                      })} ({gap.months_since_last}mo ago)
                    </p>
                  )}
                  {!gap.last_received_date && (
                    <p className="text-xs text-gray-500 mt-1">
                      No previous record found
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          <div className="pt-3 border-t border-gray-200 flex gap-2">
            <button
              onClick={() => navigate('/immunizations')}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              View All Gaps
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VaccineGapsWidget;
