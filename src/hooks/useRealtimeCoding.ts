// Real-time coding hook for Project Atlus
// Monitors coding_recommendations table for live updates

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface CodeSuggestion {
  cpt?: Array<{ code: string; modifiers?: string[]; rationale?: string }>;
  hcpcs?: Array<{ code: string; modifiers?: string[]; rationale?: string }>;
  icd10?: Array<{ code: string; rationale?: string; principal?: boolean }>;
  notes?: string;
  confidence?: number;
}

interface CodingRecommendation {
  id: string;
  encounter_id: string;
  patient_id: string | null;
  payload: CodeSuggestion;
  confidence: number | null;
  created_at: string;
}

export const useRealtimeCoding = (encounterId?: string) => {
  const [recommendations, setRecommendations] = useState<CodingRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!encounterId) return;

    const fetchRecommendations = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('coding_recommendations')
          .select('*')
          .eq('encounter_id', encounterId)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        setRecommendations(data || []);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to fetch coding recommendations';
        setError(message);

      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`coding_recs:${encounterId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coding_recommendations',
          filter: `encounter_id=eq.${encounterId}`,
        },
        (_payload) => {

          fetchRecommendations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [encounterId]);

  const latest = recommendations.length > 0 ? recommendations[0] : null;

  return {
    recommendations,
    latest,
    loading,
    error,
  };
};

export default useRealtimeCoding;
