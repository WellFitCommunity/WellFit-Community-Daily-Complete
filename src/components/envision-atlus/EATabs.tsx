/**
 * EATabs - Envision Atlus Tabs Component
 *
 * Clinical-grade tab navigation with accessible design.
 */

import React, { createContext, useContext, useState } from 'react';
import { cn } from '../../lib/utils';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

const useTabsContext = () => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within EATabs');
  }
  return context;
};

// Main Tabs Container
interface EATabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export const EATabs: React.FC<EATabsProps> = ({
  defaultValue,
  value,
  onValueChange,
  children,
  className
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeTab = value ?? internalValue;

  const setActiveTab = (newValue: string) => {
    if (!value) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn('space-y-4', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

// Tab List Container
interface EATabsListProps {
  children: React.ReactNode;
  className?: string;
}

export const EATabsList: React.FC<EATabsListProps> = ({ children, className }) => {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center justify-center rounded-lg',
        'bg-slate-800/50 p-1 border border-slate-700',
        className
      )}
    >
      {children}
    </div>
  );
};

// Individual Tab Trigger
interface EATabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export const EATabsTrigger: React.FC<EATabsTriggerProps> = ({
  value,
  children,
  className,
  disabled = false
}) => {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === value;

  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      aria-controls={`tabpanel-${value}`}
      disabled={disabled}
      onClick={() => !disabled && setActiveTab(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md',
        'px-3 py-1.5 text-sm font-medium transition-all',
        'focus:outline-none focus:ring-2 focus:ring-[#00857a]/50 focus:ring-offset-2 focus:ring-offset-slate-900',
        'disabled:pointer-events-none disabled:opacity-50',
        isActive
          ? 'bg-[#00857a] text-white shadow-sm'
          : 'text-slate-400 hover:text-white hover:bg-slate-700/50',
        className
      )}
    >
      {children}
    </button>
  );
};

// Tab Content Panel
interface EATabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const EATabsContent: React.FC<EATabsContentProps> = ({
  value,
  children,
  className
}) => {
  const { activeTab } = useTabsContext();

  if (activeTab !== value) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-${value}`}
      className={cn('mt-2 focus:outline-none', className)}
    >
      {children}
    </div>
  );
};

export default EATabs;
