/**
 * Workflow Preferences Hook
 *
 * React hook for managing role-based navigation ordering and user workflow preferences.
 *
 * Features:
 * - Role-based category ordering (nurse sees Patient Care first)
 * - User customization support
 * - Persistence via localStorage + database
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { useState, useEffect, useCallback } from 'react';
import { useUser, useSupabaseClient } from '../contexts/AuthContext';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import {
  WorkflowPreferences,
  CategoryOrder,
  getWorkflowPreferences,
  saveWorkflowPreferences,
  getDefaultPreferences,
  trackSectionAccess,
  togglePinnedSection,
  moveCategoryToTop,
} from '../services/workflowPreferences';

export interface UseWorkflowPreferencesReturn {
  // State
  preferences: WorkflowPreferences | null;
  isLoading: boolean;
  error: string | null;

  // Computed values
  categoryOrder: CategoryOrder[];
  getCategoryOpenState: (categoryId: string) => boolean;

  // Actions
  reorderCategory: (categoryId: string, newPriority: number) => Promise<void>;
  moveCategoryToTop: (categoryId: string) => Promise<void>;
  toggleCategoryOpen: (categoryId: string, isOpen: boolean) => Promise<void>;
  pinSection: (sectionId: string) => Promise<boolean>;
  trackSection: (sectionId: string) => Promise<void>;
  refreshPreferences: () => Promise<void>;
}

export function useWorkflowPreferences(): UseWorkflowPreferencesReturn {
  const user = useUser();
  const supabase = useSupabaseClient();
  const { adminRole } = useAdminAuth();

  const [preferences, setPreferences] = useState<WorkflowPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load preferences on mount and when user/role changes
  useEffect(() => {
    loadPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, adminRole]);

  const loadPreferences = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const prefs = await getWorkflowPreferences(supabase, user.id, adminRole || 'admin');
      setPreferences(prefs);
    } catch (err) {
      setError('Failed to load workflow preferences');
      // Fall back to defaults
      setPreferences(getDefaultPreferences(user.id, adminRole || 'admin'));
    } finally {
      setIsLoading(false);
    }
  }, [supabase, user?.id, adminRole]);

  // Get sorted category order
  const categoryOrder = preferences?.categoryOrder.sort((a, b) => a.priority - b.priority) || [];

  // Get whether a category should be open by default
  const getCategoryOpenState = useCallback((categoryId: string): boolean => {
    if (!preferences) return categoryId === 'revenue'; // Default fallback

    const category = preferences.categoryOrder.find(c => c.categoryId === categoryId);
    return category?.defaultOpen ?? false;
  }, [preferences]);

  // Reorder a category to a new priority
  const reorderCategory = useCallback(async (categoryId: string, newPriority: number) => {
    if (!preferences || !user?.id) return;

    const updated = preferences.categoryOrder.map(c => {
      if (c.categoryId === categoryId) {
        return { ...c, priority: newPriority };
      }
      // Shift other categories
      if (c.priority >= newPriority) {
        return { ...c, priority: c.priority + 1 };
      }
      return c;
    });

    const newPrefs = { ...preferences, categoryOrder: updated };
    setPreferences(newPrefs);

    await saveWorkflowPreferences(supabase, newPrefs);
  }, [preferences, supabase, user?.id]);

  // Move a category to the top
  const moveCategoryToTopHandler = useCallback(async (categoryId: string) => {
    if (!user?.id) return;

    await moveCategoryToTop(supabase, user.id, adminRole || 'admin', categoryId);
    await loadPreferences();
  }, [supabase, user?.id, adminRole, loadPreferences]);

  // Toggle category open state
  const toggleCategoryOpen = useCallback(async (categoryId: string, isOpen: boolean) => {
    if (!preferences || !user?.id) return;

    const updated = preferences.categoryOrder.map(c => {
      if (c.categoryId === categoryId) {
        return { ...c, defaultOpen: isOpen };
      }
      return c;
    });

    const newPrefs = { ...preferences, categoryOrder: updated };
    setPreferences(newPrefs);

    await saveWorkflowPreferences(supabase, newPrefs);
  }, [preferences, supabase, user?.id]);

  // Pin/unpin a section
  const pinSection = useCallback(async (sectionId: string): Promise<boolean> => {
    if (!user?.id) return false;

    const isPinned = await togglePinnedSection(supabase, user.id, adminRole || 'admin', sectionId);
    await loadPreferences();
    return isPinned;
  }, [supabase, user?.id, adminRole, loadPreferences]);

  // Track section access
  const trackSection = useCallback(async (sectionId: string) => {
    if (!user?.id) return;

    await trackSectionAccess(supabase, user.id, adminRole || 'admin', sectionId);
  }, [supabase, user?.id, adminRole]);

  // Refresh preferences
  const refreshPreferences = useCallback(async () => {
    await loadPreferences();
  }, [loadPreferences]);

  return {
    preferences,
    isLoading,
    error,
    categoryOrder,
    getCategoryOpenState,
    reorderCategory,
    moveCategoryToTop: moveCategoryToTopHandler,
    toggleCategoryOpen,
    pinSection,
    trackSection,
    refreshPreferences,
  };
}

export default useWorkflowPreferences;
