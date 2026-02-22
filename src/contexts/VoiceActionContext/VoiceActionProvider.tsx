/**
 * Voice Action Context — Provider & Hooks
 *
 * Global state management for intelligent voice commands.
 * Enables natural language voice commands to navigate and populate data
 * across the entire application automatically.
 *
 * ATLUS: Intuitive Technology - Voice commands that anticipate needs
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auditLogger } from '../../services/auditLogger';
import type { VoiceAction, SearchResult, VoiceActionContextType, SearchHandler, EntityType } from './types';
import { ENTITY_ROUTES } from './types';
import { parseVoiceEntity } from './parsers';

const VoiceActionContext = createContext<VoiceActionContextType | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

export const VoiceActionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const [currentAction, setCurrentAction] = useState<VoiceAction | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHandlers] = useState<Map<EntityType, SearchHandler>>(new Map());

  const generateActionId = () => `voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const registerSearchHandler = useCallback((entityType: EntityType, handler: SearchHandler) => {
    searchHandlers.set(entityType, handler);
    auditLogger.debug('VOICE_SEARCH_HANDLER_REGISTERED', { entityType });
  }, [searchHandlers]);

  const unregisterSearchHandler = useCallback((entityType: EntityType) => {
    searchHandlers.delete(entityType);
  }, [searchHandlers]);

  useEffect(() => {
    if (!currentAction || currentAction.status !== 'navigating') return;

    const targetRoute = currentAction.targetRoute;
    const currentPath = location.pathname;

    if (currentPath === targetRoute || currentPath.startsWith(targetRoute)) {
      executeSearch(currentAction);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- executeSearch is stable function
  }, [location.pathname, currentAction]);

  const executeSearch = async (action: VoiceAction) => {
    setCurrentAction(prev => prev ? { ...prev, status: 'searching' } : null);
    setIsSearching(true);

    try {
      const handler = searchHandlers.get(action.entity.type);

      if (handler) {
        const results = await handler(action.entity);
        setSearchResults(results);
        setCurrentAction(prev => prev ? {
          ...prev,
          status: 'completed',
          results,
        } : null);

        auditLogger.info('VOICE_SEARCH_COMPLETED', {
          entityType: action.entity.type,
          query: action.entity.query,
          resultCount: results.length,
        });

        if (results.length === 1 && results[0].matchScore >= 90) {
          setTimeout(() => {
            selectResult(results[0]);
          }, 500);
        }
      } else {
        const event = new CustomEvent('voiceSearch', {
          detail: {
            entity: action.entity,
            actionId: action.id,
          },
        });
        window.dispatchEvent(event);
        setCurrentAction(prev => prev ? { ...prev, status: 'completed' } : null);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Search failed';
      setCurrentAction(prev => prev ? {
        ...prev,
        status: 'failed',
        error: errorMessage,
      } : null);

      auditLogger.error('VOICE_SEARCH_FAILED', error instanceof Error ? error : new Error(errorMessage));
    } finally {
      setIsSearching(false);
    }
  };

  const processVoiceInput = useCallback(async (transcript: string, confidence: number) => {
    auditLogger.debug('VOICE_INPUT_PROCESSING', { transcript, confidence });

    const entity = parseVoiceEntity(transcript);

    if (!entity) {
      auditLogger.debug('VOICE_INPUT_NO_ENTITY', { transcript });
      return;
    }

    entity.confidence = Math.min(entity.confidence, confidence * 100);

    const targetRoute = ENTITY_ROUTES[entity.type];

    const action: VoiceAction = {
      id: generateActionId(),
      entity,
      targetRoute,
      status: 'pending',
      timestamp: new Date(),
    };

    setCurrentAction(action);
    setSearchResults([]);

    auditLogger.info('VOICE_ACTION_CREATED', {
      actionId: action.id,
      entityType: entity.type,
      query: entity.query,
      targetRoute,
    });

    const currentPath = location.pathname;
    if (currentPath === targetRoute || currentPath.startsWith(targetRoute)) {
      await executeSearch(action);
    } else {
      setCurrentAction({ ...action, status: 'navigating' });
      navigate(targetRoute);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- executeSearch is stable function
  }, [location.pathname, navigate]);

  const selectResult = useCallback((result: SearchResult) => {
    auditLogger.info('VOICE_RESULT_SELECTED', {
      resultId: result.id,
      type: result.type,
      primaryText: result.primaryText,
    });

    const event = new CustomEvent('voiceResultSelected', {
      detail: {
        result,
        actionId: currentAction?.id,
      },
    });
    window.dispatchEvent(event);

    setTimeout(() => {
      clearAction();
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clearAction is stable function
  }, [currentAction]);

  const clearAction = useCallback(() => {
    setCurrentAction(null);
    setSearchResults([]);
    setIsSearching(false);
  }, []);

  const value: VoiceActionContextType = {
    currentAction,
    searchResults,
    isSearching,
    processVoiceInput,
    selectResult,
    clearAction,
    registerSearchHandler,
    unregisterSearchHandler,
  };

  return (
    <VoiceActionContext.Provider value={value}>
      {children}
    </VoiceActionContext.Provider>
  );
};

// ============================================================================
// HOOKS
// ============================================================================

export function useVoiceAction(): VoiceActionContextType {
  const context = useContext(VoiceActionContext);
  if (!context) {
    throw new Error('useVoiceAction must be used within VoiceActionProvider');
  }
  return context;
}

export function useVoiceActionSafe(): VoiceActionContextType | null {
  return useContext(VoiceActionContext);
}

export function useVoiceSearchHandler(
  entityType: EntityType,
  handler: SearchHandler,
  deps: React.DependencyList = []
) {
  const context = useVoiceActionSafe();

  useEffect(() => {
    if (!context) return;

    context.registerSearchHandler(entityType, handler);

    return () => {
      context.unregisterSearchHandler(entityType);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, entityType, ...deps]);
}

export default VoiceActionContext;
