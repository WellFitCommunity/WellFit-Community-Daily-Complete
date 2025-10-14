// src/hooks/useFormDraftRecovery.ts
// Automatically saves and recovers form drafts using localStorage

import { useState, useEffect, useCallback } from 'react';

interface UseFormDraftRecoveryOptions<T> {
  key: string;
  debounceMs?: number;
  enabled?: boolean;
}

export function useFormDraftRecovery<T extends Record<string, any>>(
  initialData: T,
  options: UseFormDraftRecoveryOptions<T>
) {
  const { key, debounceMs = 1000, enabled = true } = options;
  const storageKey = `form-draft-${key}`;

  const [formData, setFormData] = useState<T>(() => {
    if (!enabled) return initialData;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with initial data to handle schema changes
        return { ...initialData, ...parsed };
      }
    } catch (error) {
      console.error('Failed to load form draft:', error);
    }
    return initialData;
  });

  const [hasDraft, setHasDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Check for existing draft on mount
  useEffect(() => {
    if (!enabled) return;

    try {
      const saved = localStorage.getItem(storageKey);
      setHasDraft(!!saved);
    } catch (error) {
      console.error('Failed to check for draft:', error);
    }
  }, [storageKey, enabled]);

  // Save draft with debouncing
  useEffect(() => {
    if (!enabled) return;

    const timer = setTimeout(() => {
      try {
        // Don't save if form is empty
        const hasContent = Object.values(formData).some(value => {
          if (typeof value === 'string') return value.trim().length > 0;
          if (typeof value === 'number') return value !== 0;
          if (Array.isArray(value)) return value.length > 0;
          return !!value;
        });

        if (hasContent) {
          localStorage.setItem(storageKey, JSON.stringify(formData));
          setLastSaved(new Date());
          setHasDraft(true);
        }
      } catch (error) {
        console.error('Failed to save form draft:', error);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [formData, storageKey, debounceMs, enabled]);

  const updateFormData = useCallback((updates: Partial<T>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setHasDraft(false);
      setLastSaved(null);
      setFormData(initialData);
    } catch (error) {
      console.error('Failed to clear form draft:', error);
    }
  }, [storageKey, initialData]);

  const restoreDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setFormData({ ...initialData, ...parsed });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to restore draft:', error);
      return false;
    }
  }, [storageKey, initialData]);

  return {
    formData,
    updateFormData,
    setFormData,
    clearDraft,
    restoreDraft,
    hasDraft,
    lastSaved,
  };
}
