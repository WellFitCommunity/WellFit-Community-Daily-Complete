// =====================================================
// COMMAND PALETTE (Cmd+K)
// Purpose: Quick access to any feature in PhysicianPanel
// Reduces cognitive overload with fuzzy search
// =====================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// Optimized imports for tree-shaking (saves ~15-20KB per file)
// Only importing icons actually used in this file
import Search from 'lucide-react/dist/esm/icons/search';
import Clock from 'lucide-react/dist/esm/icons/clock';
import Brain from 'lucide-react/dist/esm/icons/brain';
import Zap from 'lucide-react/dist/esm/icons/zap';
import Star from 'lucide-react/dist/esm/icons/star';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';

// =====================================================
// TYPES
// =====================================================

export interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<any>;
  category: 'clinical' | 'admin' | 'wellness' | 'quick-access';
  keywords: string[];
  action: () => void;
  gradient: string;
  badge?: string;
}

interface CommandPaletteProps {
  actions: CommandAction[];
  recentActions?: string[]; // IDs of recently used actions
  pinnedActions?: string[]; // IDs of pinned actions
  onActionExecute?: (actionId: string) => void;
}

// =====================================================
// FUZZY SEARCH
// =====================================================

const fuzzyMatch = (query: string, target: string): number => {
  query = query.toLowerCase();
  target = target.toLowerCase();

  let queryIndex = 0;
  let targetIndex = 0;
  let score = 0;
  let consecutiveMatches = 0;

  while (queryIndex < query.length && targetIndex < target.length) {
    if (query[queryIndex] === target[targetIndex]) {
      score += 1 + consecutiveMatches * 2; // Bonus for consecutive matches
      consecutiveMatches++;
      queryIndex++;
    } else {
      consecutiveMatches = 0;
    }
    targetIndex++;
  }

  return queryIndex === query.length ? score : 0;
};

const searchActions = (query: string, actions: CommandAction[]): CommandAction[] => {
  if (!query.trim()) return actions;

  return actions
    .map((action) => {
      const labelScore = fuzzyMatch(query, action.label);
      const descScore = action.description ? fuzzyMatch(query, action.description) : 0;
      const keywordScore = Math.max(
        ...action.keywords.map((keyword) => fuzzyMatch(query, keyword)),
        0
      );

      return {
        action,
        score: labelScore * 3 + descScore + keywordScore * 2,
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((result) => result.action);
};

// =====================================================
// COMMAND PALETTE COMPONENT
// =====================================================

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  actions,
  recentActions = [],
  pinnedActions = [],
  onActionExecute,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filteredActions, setFilteredActions] = useState<CommandAction[]>(actions);
  const inputRef = useRef<HTMLInputElement>(null);

  // =====================================================
  // KEYBOARD SHORTCUTS
  // =====================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open palette: Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }

      // Close palette: Escape
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
        setSelectedIndex(0);
      }

      // Navigate: Arrow Up/Down
      if (isOpen && e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredActions.length);
      }

      if (isOpen && e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredActions.length) % filteredActions.length);
      }

      // Execute: Enter
      if (isOpen && e.key === 'Enter' && filteredActions[selectedIndex]) {
        e.preventDefault();
        executeAction(filteredActions[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredActions]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Update filtered actions when query changes
  useEffect(() => {
    const results = searchActions(query, actions);
    setFilteredActions(results);
    setSelectedIndex(0);
  }, [query, actions]);

  // =====================================================
  // ACTION EXECUTION
  // =====================================================

  const executeAction = (action: CommandAction) => {
    action.action();
    onActionExecute?.(action.id);
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
  };

  // =====================================================
  // ORGANIZE ACTIONS
  // =====================================================

  const organizeActions = useCallback(() => {
    if (query.trim()) return filteredActions;

    // When no query, show: Pinned → Recent → All
    const pinned = actions.filter((a) => pinnedActions.includes(a.id));
    const recent = actions.filter(
      (a) => recentActions.includes(a.id) && !pinnedActions.includes(a.id)
    );
    const rest = actions.filter(
      (a) => !pinnedActions.includes(a.id) && !recentActions.includes(a.id)
    );

    return [...pinned, ...recent, ...rest];
  }, [query, filteredActions, actions, pinnedActions, recentActions]);

  const displayActions = organizeActions();

  // =====================================================
  // CATEGORY BADGES
  // =====================================================

  const getCategoryBadge = (category: string) => {
    const badges = {
      clinical: { text: 'Clinical', color: 'bg-blue-100 text-blue-700' },
      admin: { text: 'Admin', color: 'bg-purple-100 text-purple-700' },
      wellness: { text: 'Wellness', color: 'bg-green-100 text-green-700' },
      'quick-access': { text: 'Quick', color: 'bg-amber-100 text-amber-700' },
    };

    return badges[category as keyof typeof badges] || badges.clinical;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/50 backdrop-blur-xs"
        onClick={() => setIsOpen(false)}
      >
        <motion.div
          initial={{ scale: 0.95, y: -20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: -20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="relative border-b border-gray-200">
            <Search className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search commands... (Cmd+K)"
              className="w-full pl-12 pr-4 py-4 text-lg focus:outline-hidden"
            />
            <div className="absolute right-4 top-4 flex items-center gap-2">
              <kbd className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-sm border border-gray-300">
                ↑↓
              </kbd>
              <kbd className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-sm border border-gray-300">
                Enter
              </kbd>
              <kbd className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-sm border border-gray-300">
                Esc
              </kbd>
            </div>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {displayActions.length === 0 ? (
              <div className="py-12 text-center">
                <Brain className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">No commands found</p>
                <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
              </div>
            ) : (
              <div className="py-2">
                {/* Pinned Section */}
                {!query && pinnedActions.length > 0 && (
                  <div className="mb-2">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      <Star className="w-3 h-3" />
                      Pinned
                    </div>
                    {displayActions
                      .filter((a) => pinnedActions.includes(a.id))
                      .map((action, index) => (
                        <CommandItem
                          key={action.id}
                          action={action}
                          isSelected={selectedIndex === index}
                          onClick={() => executeAction(action)}
                          getCategoryBadge={getCategoryBadge}
                        />
                      ))}
                  </div>
                )}

                {/* Recent Section */}
                {!query && recentActions.length > 0 && (
                  <div className="mb-2">
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      Recent
                    </div>
                    {displayActions
                      .filter((a) => recentActions.includes(a.id) && !pinnedActions.includes(a.id))
                      .slice(0, 5)
                      .map((action, index) => {
                        const adjustedIndex = index + pinnedActions.length;
                        return (
                          <CommandItem
                            key={action.id}
                            action={action}
                            isSelected={selectedIndex === adjustedIndex}
                            onClick={() => executeAction(action)}
                            getCategoryBadge={getCategoryBadge}
                          />
                        );
                      })}
                  </div>
                )}

                {/* All Commands / Search Results */}
                {query ? (
                  <div>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Search Results
                    </div>
                    {displayActions.map((action, index) => (
                      <CommandItem
                        key={action.id}
                        action={action}
                        isSelected={selectedIndex === index}
                        onClick={() => executeAction(action)}
                        getCategoryBadge={getCategoryBadge}
                      />
                    ))}
                  </div>
                ) : (
                  <div>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      All Commands
                    </div>
                    {displayActions
                      .filter(
                        (a) => !pinnedActions.includes(a.id) && !recentActions.includes(a.id)
                      )
                      .map((action, index) => {
                        const adjustedIndex =
                          index + pinnedActions.length + recentActions.slice(0, 5).length;
                        return (
                          <CommandItem
                            key={action.id}
                            action={action}
                            isSelected={selectedIndex === adjustedIndex}
                            onClick={() => executeAction(action)}
                            getCategoryBadge={getCategoryBadge}
                          />
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-4 py-3 bg-linear-to-r from-blue-50 to-cyan-50">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>
                Showing {displayActions.length} of {actions.length} commands
              </span>
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-blue-500" />
                <span className="text-blue-600 font-medium">Quick access to everything</span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// =====================================================
// COMMAND ITEM COMPONENT
// =====================================================

interface CommandItemProps {
  action: CommandAction;
  isSelected: boolean;
  onClick: () => void;
  getCategoryBadge: (category: string) => { text: string; color: string };
}

const CommandItem: React.FC<CommandItemProps> = ({
  action,
  isSelected,
  onClick,
  getCategoryBadge,
}) => {
  const Icon = action.icon;
  const categoryBadge = getCategoryBadge(action.category);

  return (
    <motion.div
      whileHover={{ x: 4 }}
      className={`
        px-4 py-3 cursor-pointer transition-all
        ${isSelected ? `bg-linear-to-r ${action.gradient} text-white` : 'hover:bg-gray-50'}
      `}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div
          className={`
          w-10 h-10 rounded-lg flex items-center justify-center
          ${isSelected ? 'bg-white/20' : `bg-linear-to-br ${action.gradient}`}
        `}
        >
          <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-white'}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-semibold ${isSelected ? 'text-white' : 'text-gray-800'}`}>
              {action.label}
            </span>
            {action.badge && (
              <span
                className={`
                px-2 py-0.5 text-xs font-medium rounded-full
                ${isSelected ? 'bg-white/30 text-white' : 'bg-blue-100 text-blue-700'}
              `}
              >
                {action.badge}
              </span>
            )}
          </div>
          {action.description && (
            <p
              className={`text-sm truncate ${isSelected ? 'text-white/80' : 'text-gray-500'}`}
            >
              {action.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`
            px-2 py-1 text-xs font-medium rounded
            ${isSelected ? 'bg-white/20 text-white' : categoryBadge.color}
          `}
          >
            {categoryBadge.text}
          </span>
          <ArrowRight className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
        </div>
      </div>
    </motion.div>
  );
};

// =====================================================
// COMMAND PALETTE HOOK
// =====================================================

export const useCommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return { isOpen, open, close, toggle };
};
