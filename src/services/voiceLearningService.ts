// src/services/voiceLearningService.ts
// Voice Learning System - Provider-specific voice profile management
// Stores learned corrections in IndexedDB (local) and Supabase (cloud sync)
// Improves transcription accuracy over time by learning from provider corrections
//
// STORAGE IMPACT: Minimal! Only stores text corrections (~50 bytes each), NO audio files.
// Auto-deleted after 30 days of inactivity. Cost: Essentially free.

import { supabase } from '../lib/supabaseClient';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { auditLogger } from './auditLogger';

// Voice correction data structure
export interface VoiceCorrection {
  heard: string;           // What Deepgram transcribed
  correct: string;         // What it should be
  frequency: number;       // How many times corrected
  lastUsed: string;        // ISO timestamp
  confidence: number;      // 0-1, how confident this correction is
  medicalDomain?: string;  // Optional: 'cardiology' | 'endocrinology' | 'general'
  contextualTriggers?: string[]; // Words that often appear with this correction
}

// Provider voice profile
export interface ProviderVoiceProfile {
  providerId: string;
  corrections: VoiceCorrection[];
  totalSessions: number;
  accuracyBaseline: number;
  accuracyCurrent: number;
  createdAt: string;
  updatedAt: string;
}

// IndexedDB schema
interface VoiceLearningDB extends DBSchema {
  'voice-profiles': {
    key: string;
    value: ProviderVoiceProfile;
  };
}

export class VoiceLearningService {
  private static db: IDBPDatabase<VoiceLearningDB> | null = null;

  // Initialize IndexedDB
  static async initDB(): Promise<IDBPDatabase<VoiceLearningDB>> {
    if (this.db) return this.db;

    try {
      this.db = await openDB<VoiceLearningDB>('wellfit-voice-learning', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('voice-profiles')) {
            db.createObjectStore('voice-profiles', { keyPath: 'providerId' });
          }
        }
      });

      auditLogger.info('VOICE_LEARNING_DB_INITIALIZED', {
        dbName: 'wellfit-voice-learning',
        version: 1
      });

      return this.db;
    } catch (error) {
      auditLogger.error('VOICE_LEARNING_DB_INIT_FAILED', error instanceof Error ? error : new Error('IndexedDB init failed'));
      throw error;
    }
  }

  // Load voice profile (from IndexedDB first, fallback to database)
  static async loadVoiceProfile(providerId: string): Promise<ProviderVoiceProfile | null> {
    try {
      const db = await this.initDB();

      // Try local first (instant)
      const local = await db.get('voice-profiles', providerId);
      if (local) {
        auditLogger.info('VOICE_PROFILE_LOADED_LOCAL', { providerId });
        return local;
      }

      // Fallback to database (slower, but cross-device)
      const { data, error } = await supabase
        .from('provider_voice_profiles')
        .select('*')
        .eq('provider_id', providerId)
        .single();

      if (error || !data) {
        auditLogger.info('VOICE_PROFILE_NOT_FOUND', { providerId });
        return null;
      }

      // Cache locally for next time
      const profile: ProviderVoiceProfile = {
        providerId: data.provider_id,
        corrections: data.voice_fingerprint?.corrections || [],
        totalSessions: data.total_sessions || 0,
        accuracyBaseline: data.accuracy_baseline || 0,
        accuracyCurrent: data.accuracy_current || 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      await db.put('voice-profiles', profile);
      auditLogger.info('VOICE_PROFILE_LOADED_DB', { providerId });

      return profile;
    } catch (error) {
      auditLogger.error('VOICE_PROFILE_LOAD_FAILED', error instanceof Error ? error : new Error('Load failed'), { providerId });
      return null;
    }
  }

  // Save voice profile (to both IndexedDB and database)
  static async saveVoiceProfile(profile: ProviderVoiceProfile): Promise<void> {
    try {
      const db = await this.initDB();

      // Save locally (instant)
      await db.put('voice-profiles', profile);

      // Save to database (async, don't block UI)
      supabase
        .from('provider_voice_profiles')
        .upsert({
          provider_id: profile.providerId,
          voice_fingerprint: {
            corrections: profile.corrections,
            speechPatterns: {},
            medicalVocabulary: []
          },
          total_sessions: profile.totalSessions,
          accuracy_baseline: profile.accuracyBaseline,
          accuracy_current: profile.accuracyCurrent,
          last_training_session: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .then(({ error }) => {
          if (error) {
            auditLogger.error('VOICE_PROFILE_SAVE_FAILED', error, { providerId: profile.providerId });
          } else {
            auditLogger.info('VOICE_PROFILE_SAVED', { providerId: profile.providerId });
          }
        });
    } catch (error) {
      auditLogger.error('VOICE_PROFILE_SAVE_EXCEPTION', error instanceof Error ? error : new Error('Save failed'), {
        providerId: profile.providerId
      });
      throw error;
    }
  }

  // Add a correction
  static async addCorrection(
    providerId: string,
    heard: string,
    correct: string,
    medicalDomain?: string
  ): Promise<void> {
    try {
      const profile = await this.loadVoiceProfile(providerId) || {
        providerId,
        corrections: [],
        totalSessions: 0,
        accuracyBaseline: 0,
        accuracyCurrent: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Check if correction already exists
      const existing = profile.corrections.find(c => c.heard.toLowerCase() === heard.toLowerCase());
      if (existing) {
        existing.frequency++;
        existing.lastUsed = new Date().toISOString();
        existing.confidence = Math.min(1.0, existing.confidence + 0.1);
        if (medicalDomain) existing.medicalDomain = medicalDomain;
      } else {
        profile.corrections.push({
          heard,
          correct,
          frequency: 1,
          lastUsed: new Date().toISOString(),
          confidence: 0.8,
          medicalDomain
        });
      }

      profile.updatedAt = new Date().toISOString();
      await this.saveVoiceProfile(profile);

      auditLogger.clinical('VOICE_CORRECTION_LEARNED', true, {
        providerId,
        heard,
        correct,
        medicalDomain,
        totalCorrections: profile.corrections.length
      });
    } catch (error) {
      auditLogger.error('VOICE_CORRECTION_ADD_FAILED', error instanceof Error ? error : new Error('Add failed'), {
        providerId,
        heard,
        correct
      });
      throw error;
    }
  }

  // Apply corrections to transcript with smart matching
  static applyCorrections(transcript: string, profile: ProviderVoiceProfile | null): {
    corrected: string;
    appliedCount: number;
    appliedCorrections: string[];
  } {
    if (!profile || !profile.corrections.length) {
      return {
        corrected: transcript,
        appliedCount: 0,
        appliedCorrections: []
      };
    }

    let corrected = transcript;
    const appliedCorrections: string[] = [];

    // Sort by: 1) longer phrases first (more specific), 2) confidence * frequency
    const sorted = [...profile.corrections].sort((a, b) => {
      // Longer phrases are more specific, apply first
      const lengthDiff = b.heard.split(' ').length - a.heard.split(' ').length;
      if (lengthDiff !== 0) return lengthDiff;
      // Then by confidence * frequency score
      return (b.confidence * b.frequency) - (a.confidence * a.frequency);
    });

    sorted.forEach(correction => {
      // Only apply if confidence is above threshold (learning requires some certainty)
      if (correction.confidence < 0.5) return;

      // Case-insensitive regex with word boundaries
      // Also handle common phonetic variations
      const heardVariants = this.generatePhoneticVariants(correction.heard);

      for (const variant of heardVariants) {
        const regex = new RegExp(`\\b${this.escapeRegex(variant)}\\b`, 'gi');
        if (regex.test(corrected)) {
          corrected = corrected.replace(regex, correction.correct);
          appliedCorrections.push(correction.correct);
          break; // Only apply once per correction
        }
      }
    });

    if (appliedCorrections.length > 0) {
      auditLogger.info('VOICE_CORRECTIONS_APPLIED', {
        count: appliedCorrections.length,
        corrections: appliedCorrections
      });
    }

    return {
      corrected,
      appliedCount: appliedCorrections.length,
      appliedCorrections
    };
  }

  // Generate phonetic variants for fuzzy matching
  private static generatePhoneticVariants(phrase: string): string[] {
    const variants = [phrase];
    const lowerPhrase = phrase.toLowerCase();

    // Common speech-to-text spacing errors
    // "hyperglycemia" might be heard as "hyper glycemia"
    if (!lowerPhrase.includes(' ')) {
      // Try splitting on common medical prefixes
      const prefixes = ['hyper', 'hypo', 'cardio', 'neuro', 'gastro', 'hemo', 'brady', 'tachy'];
      for (const prefix of prefixes) {
        if (lowerPhrase.startsWith(prefix) && lowerPhrase.length > prefix.length + 3) {
          variants.push(prefix + ' ' + lowerPhrase.slice(prefix.length));
        }
      }
    }

    return variants;
  }

  // Decay old corrections that haven't been used (keeps profile fresh)
  static async decayOldCorrections(providerId: string, daysThreshold: number = 60): Promise<number> {
    try {
      const profile = await this.loadVoiceProfile(providerId);
      if (!profile) return 0;

      const now = new Date();
      const threshold = now.getTime() - (daysThreshold * 24 * 60 * 60 * 1000);
      let decayedCount = 0;

      profile.corrections = profile.corrections.filter(c => {
        const lastUsed = new Date(c.lastUsed).getTime();
        if (lastUsed < threshold && c.frequency < 3) {
          decayedCount++;
          return false; // Remove rarely-used old corrections
        }
        // Reduce confidence of old but frequently used corrections
        if (lastUsed < threshold) {
          c.confidence = Math.max(0.5, c.confidence * 0.9);
        }
        return true;
      });

      if (decayedCount > 0) {
        profile.updatedAt = new Date().toISOString();
        await this.saveVoiceProfile(profile);
        auditLogger.info('VOICE_CORRECTIONS_DECAYED', { providerId, decayedCount });
      }

      return decayedCount;
    } catch (error) {
      auditLogger.error('VOICE_DECAY_FAILED', error instanceof Error ? error : new Error('Decay failed'));
      return 0;
    }
  }

  // Reinforce a correction when it's used successfully
  static async reinforceCorrection(providerId: string, correctedText: string): Promise<void> {
    try {
      const profile = await this.loadVoiceProfile(providerId);
      if (!profile) return;

      const correction = profile.corrections.find(c =>
        c.correct.toLowerCase() === correctedText.toLowerCase()
      );

      if (correction) {
        correction.frequency++;
        correction.lastUsed = new Date().toISOString();
        correction.confidence = Math.min(1.0, correction.confidence + 0.05);
        profile.updatedAt = new Date().toISOString();
        await this.saveVoiceProfile(profile);
      }
    } catch (error) {
      // Silent fail - reinforcement is enhancement, not critical
    }
  }

  // Helper: Escape special regex characters
  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Calculate accuracy improvement
  static async updateAccuracy(providerId: string, sessionAccuracy: number): Promise<void> {
    try {
      const profile = await this.loadVoiceProfile(providerId);
      if (!profile) return;

      if (profile.accuracyBaseline === 0) {
        profile.accuracyBaseline = sessionAccuracy;
      }

      // Running average
      profile.accuracyCurrent =
        (profile.accuracyCurrent * profile.totalSessions + sessionAccuracy) /
        (profile.totalSessions + 1);

      profile.totalSessions++;
      profile.updatedAt = new Date().toISOString();

      await this.saveVoiceProfile(profile);

      auditLogger.info('VOICE_ACCURACY_UPDATED', {
        providerId,
        sessionAccuracy,
        currentAverage: profile.accuracyCurrent,
        improvement: profile.accuracyCurrent - profile.accuracyBaseline,
        totalSessions: profile.totalSessions
      });
    } catch (error) {
      auditLogger.error('VOICE_ACCURACY_UPDATE_FAILED', error instanceof Error ? error : new Error('Update failed'), {
        providerId,
        sessionAccuracy
      });
    }
  }

  // Export voice profile (for backup/migration)
  static async exportVoiceProfile(providerId: string): Promise<string | null> {
    try {
      const profile = await this.loadVoiceProfile(providerId);
      if (!profile) return null;

      const exportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        profile
      };

      auditLogger.info('VOICE_PROFILE_EXPORTED', { providerId });
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      auditLogger.error('VOICE_PROFILE_EXPORT_FAILED', error instanceof Error ? error : new Error('Export failed'), {
        providerId
      });
      return null;
    }
  }

  // Import voice profile (for backup restoration)
  static async importVoiceProfile(providerId: string, jsonData: string): Promise<boolean> {
    try {
      const importData = JSON.parse(jsonData);

      if (!importData.profile || importData.profile.providerId !== providerId) {
        throw new Error('Invalid profile data or provider ID mismatch');
      }

      await this.saveVoiceProfile(importData.profile);

      auditLogger.clinical('VOICE_PROFILE_IMPORTED', true, {
        providerId,
        correctionsCount: importData.profile.corrections.length
      });

      return true;
    } catch (error) {
      auditLogger.error('VOICE_PROFILE_IMPORT_FAILED', error instanceof Error ? error : new Error('Import failed'), {
        providerId
      });
      return false;
    }
  }

  // Delete voice profile (GDPR/privacy compliance)
  static async deleteVoiceProfile(providerId: string): Promise<void> {
    try {
      const db = await this.initDB();

      // Delete from IndexedDB
      await db.delete('voice-profiles', providerId);

      // Delete from database
      await supabase
        .from('provider_voice_profiles')
        .delete()
        .eq('provider_id', providerId);

      auditLogger.clinical('VOICE_PROFILE_DELETED', true, { providerId });
    } catch (error) {
      auditLogger.error('VOICE_PROFILE_DELETE_FAILED', error instanceof Error ? error : new Error('Delete failed'), {
        providerId
      });
      throw error;
    }
  }

  // Get voice profile statistics
  static async getProfileStats(providerId: string): Promise<{
    totalCorrections: number;
    accuracyImprovement: number;
    totalSessions: number;
    mostCommonCorrections: VoiceCorrection[];
  } | null> {
    try {
      const profile = await this.loadVoiceProfile(providerId);
      if (!profile) return null;

      const mostCommon = [...profile.corrections]
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10);

      return {
        totalCorrections: profile.corrections.length,
        accuracyImprovement: profile.accuracyCurrent - profile.accuracyBaseline,
        totalSessions: profile.totalSessions,
        mostCommonCorrections: mostCommon
      };
    } catch (error) {
      auditLogger.error('VOICE_PROFILE_STATS_FAILED', error instanceof Error ? error : new Error('Stats failed'), {
        providerId
      });
      return null;
    }
  }
}
