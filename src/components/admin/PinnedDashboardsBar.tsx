/**
 * Pinned Dashboards Bar
 *
 * Renders the user's pinned sections at the top of Mission Control.
 * Pinned sections appear above all categories — zero clicks to reach them.
 * Max 6 pinned sections. Each section renders inline (no category wrapper).
 */

import React, { Suspense, useMemo } from 'react';
import { Pin, X } from 'lucide-react';
import { usePinnedSections } from '../../contexts/PinnedSectionsContext';
import { getAllSections } from './sections/sectionDefinitions';
import { DashboardSection } from './sections/types';

const PinnedLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
    <span className="ml-3 text-gray-600">Loading pinned section...</span>
  </div>
);

interface PinnedSectionCardProps {
  section: DashboardSection;
  onUnpin: () => void;
}

const PinnedSectionCard: React.FC<PinnedSectionCardProps> = ({ section, onUnpin }) => {
  const [isExpanded, setIsExpanded] = React.useState(true);

  return (
    <section className="bg-white rounded-xl shadow-lg border-2 border-amber-200 overflow-hidden transition-all duration-200 hover:shadow-xl">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-amber-50/50 transition-colors border-b border-amber-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center flex-1">
          <span className="text-2xl mr-3" aria-hidden="true">{section.icon}</span>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h2 className={`text-xl font-semibold ${section.headerColor}`}>
                {section.title}
              </h2>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium flex items-center gap-1">
                <Pin className="w-3 h-3" />
                Pinned
              </span>
            </div>
            {section.subtitle && <p className="text-sm text-gray-600 mt-1">{section.subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnpin();
            }}
            className="p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ea-primary,#00857a)]"
            title="Unpin this section"
            aria-label={`Unpin ${section.title}`}
          >
            <X className="w-4 h-4" />
          </button>
          <span
            className={`text-gray-500 transform transition-transform duration-200 text-xl ${
              isExpanded ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          >
            &#8964;
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="p-6">
          <Suspense fallback={<PinnedLoadingFallback />}>
            {section.component}
          </Suspense>
        </div>
      )}
    </section>
  );
};

const PinnedDashboardsBar: React.FC = () => {
  const { pinnedIds, togglePin, isLoading } = usePinnedSections();

  const allSections = useMemo(() => getAllSections(), []);

  const pinnedSections = useMemo(() => {
    return pinnedIds
      .map(id => allSections.find(s => s.id === id))
      .filter((s): s is DashboardSection => s !== undefined);
  }, [pinnedIds, allSections]);

  if (isLoading || pinnedSections.length === 0) return null;

  return (
    <div className="space-y-4" aria-label="Pinned Dashboards Bar">
      <div className="flex items-center gap-2">
        <Pin className="w-5 h-5 text-amber-600" />
        <h3 className="text-lg font-bold text-gray-900">Pinned Dashboards</h3>
        <span className="text-xs text-gray-500">{pinnedSections.length}/6</span>
      </div>
      <div className="space-y-4">
        {pinnedSections.map(section => (
          <PinnedSectionCard
            key={section.id}
            section={section}
            onUnpin={() => togglePin(section.id)}
          />
        ))}
      </div>
    </div>
  );
};

export default PinnedDashboardsBar;
