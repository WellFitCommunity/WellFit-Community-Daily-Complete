/**
 * Pinned Sections Context
 *
 * Provides pinned section state to the admin panel tree.
 * Avoids prop-drilling through 5 category components.
 * Uses the existing workflowPreferences service for persistence.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useUser, useSupabaseClient } from './AuthContext';
import { useAdminAuth } from './AdminAuthContext';
import {
  getWorkflowPreferences,
  togglePinnedSection,
  getDefaultPreferences,
} from '../services/workflowPreferences';

interface PinnedSectionsContextValue {
  pinnedIds: string[];
  isPinned: (sectionId: string) => boolean;
  togglePin: (sectionId: string) => Promise<void>;
  isLoading: boolean;
}

const PinnedSectionsContext = createContext<PinnedSectionsContextValue>({
  pinnedIds: [],
  isPinned: () => false,
  togglePin: async () => {},
  isLoading: true,
});

const MAX_PINNED = 6;

export const PinnedSectionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useUser();
  const supabase = useSupabaseClient();
  const { adminRole } = useAdminAuth();
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      try {
        const prefs = await getWorkflowPreferences(supabase, user.id, adminRole || 'admin');
        setPinnedIds(prefs.pinnedSections || []);
      } catch {
        const defaults = getDefaultPreferences(user.id, adminRole || 'admin');
        setPinnedIds(defaults.pinnedSections || []);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user?.id, adminRole, supabase]);

  const isPinned = useCallback((sectionId: string) => pinnedIds.includes(sectionId), [pinnedIds]);

  const togglePin = useCallback(async (sectionId: string) => {
    if (!user?.id) return;

    const alreadyPinned = pinnedIds.includes(sectionId);
    if (!alreadyPinned && pinnedIds.length >= MAX_PINNED) return;

    // Optimistic update
    setPinnedIds(prev =>
      alreadyPinned ? prev.filter(id => id !== sectionId) : [...prev, sectionId]
    );

    // Persist
    await togglePinnedSection(supabase, user.id, adminRole || 'admin', sectionId);
  }, [user?.id, pinnedIds, supabase, adminRole]);

  return (
    <PinnedSectionsContext.Provider value={{ pinnedIds, isPinned, togglePin, isLoading }}>
      {children}
    </PinnedSectionsContext.Provider>
  );
};

export const usePinnedSections = () => useContext(PinnedSectionsContext);
