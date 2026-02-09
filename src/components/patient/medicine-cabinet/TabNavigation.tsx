/**
 * TabNavigation — Medicine Cabinet tab bar
 *
 * Horizontal tab navigation for switching between medication views.
 */

import React from 'react';
import {
  Pill,
  Camera,
  Search,
  Shield,
  BarChart3,
  Bell
} from 'lucide-react';
import { TabNavigationProps, TabId } from './MedicineCabinet.types';

const TABS: Array<{ id: TabId; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'all', label: 'All Medications', icon: Pill },
  { id: 'scan', label: 'Scan Label', icon: Camera },
  { id: 'identify', label: 'Identify Pill', icon: Search },
  { id: 'verify', label: 'Verify Pill', icon: Shield },
  { id: 'adherence', label: 'Adherence', icon: BarChart3 },
  { id: 'reminders', label: 'Reminders', icon: Bell }
];

export const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="max-w-7xl mx-auto mb-6">
      <div className="flex gap-2 bg-white rounded-xl shadow-md p-2 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-linear-to-r from-blue-600 to-purple-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};
