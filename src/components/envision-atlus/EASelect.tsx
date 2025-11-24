/**
 * EASelect - Envision Atlus Select Component
 *
 * Dropdown styled for clinical dashboards.
 */

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown, Check } from 'lucide-react';

// Context
interface SelectContextValue {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SelectContext = createContext<SelectContextValue | null>(null);

function useSelectContext() {
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error('EASelect components must be used within EASelect');
  }
  return context;
}

// Root
interface EASelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}

export const EASelect: React.FC<EASelectProps> = ({ value, onValueChange, children }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div ref={containerRef} className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  );
};

// Trigger
interface EASelectTriggerProps {
  className?: string;
  placeholder?: string;
  children?: React.ReactNode;
}

export const EASelectTrigger: React.FC<EASelectTriggerProps> = ({ className, placeholder, children }) => {
  const { open, setOpen } = useSelectContext();

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-md px-3 py-2 text-sm',
        'bg-slate-700 border border-slate-600 text-white',
        'focus:outline-none focus:ring-2 focus:ring-[#00857a]/50 focus:border-[#00857a]',
        'hover:border-slate-500 transition-colors',
        className
      )}
    >
      <span className={cn(!children && 'text-slate-400')}>
        {children || placeholder || 'Select...'}
      </span>
      <ChevronDown
        className={cn(
          'h-4 w-4 text-slate-400 transition-transform duration-200',
          open && 'rotate-180'
        )}
      />
    </button>
  );
};

// Value display
export const EASelectValue: React.FC<{ placeholder?: string }> = ({ placeholder }) => {
  const { value } = useSelectContext();
  return <>{value || placeholder || 'Select...'}</>;
};

// Content dropdown
interface EASelectContentProps {
  className?: string;
  children: React.ReactNode;
}

export const EASelectContent: React.FC<EASelectContentProps> = ({ className, children }) => {
  const { open } = useSelectContext();

  if (!open) return null;

  return (
    <div
      className={cn(
        'absolute z-50 mt-1 w-full rounded-md',
        'bg-slate-700 border border-slate-600 shadow-lg shadow-black/30',
        'max-h-60 overflow-auto',
        'animate-in fade-in-0 zoom-in-95 duration-100',
        className
      )}
    >
      <div className="py-1">{children}</div>
    </div>
  );
};

// Item
interface EASelectItemProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

export const EASelectItem: React.FC<EASelectItemProps> = ({ value, className, children }) => {
  const { value: selectedValue, onValueChange, setOpen } = useSelectContext();
  const isSelected = selectedValue === value;

  return (
    <div
      onClick={() => {
        onValueChange(value);
        setOpen(false);
      }}
      className={cn(
        'relative flex cursor-pointer select-none items-center px-3 py-2 text-sm',
        'text-slate-200 hover:bg-slate-600 transition-colors',
        isSelected && 'bg-[#00857a]/20 text-[#33bfb7]',
        className
      )}
    >
      <span className="flex-1">{children}</span>
      {isSelected && <Check className="h-4 w-4 text-[#00857a]" />}
    </div>
  );
};

export default EASelect;
