// ============================================================================
// Resource Library - Self-Care Resources for Nurses
// ============================================================================
// Purpose: Curated library of crisis hotlines, apps, articles, and support
// Features: Category filtering, featured resources, quick access to 988
// ============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { getResources, trackResourceView } from '../../services/resilienceHubService';
import type { ResilienceResource } from '../../types/nurseos';

interface ResourceLibraryProps {
  onClose: () => void;
  userRole?: string; // 'physician', 'nurse', 'care_manager', etc.
}

export const ResourceLibrary: React.FC<ResourceLibraryProps> = ({ onClose, userRole }) => {
  const [resources, setResources] = useState<ResilienceResource[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load resources
  const loadResources = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: { category?: string; resource_type?: string; userRole?: string } = {};
      if (selectedCategory !== 'all') {
        filters.category = selectedCategory;
      }
      if (selectedType !== 'all') {
        filters.resource_type = selectedType;
      }
      if (userRole) {
        filters.userRole = userRole;
      }

      const data = await getResources(filters);
      setResources(data);
    } catch (err) {

      setError(err instanceof Error ? err.message : 'Failed to load resources');
    } finally {
      setLoading(false);
    }
  }, [selectedType, selectedCategory, userRole]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  // Handle resource click
  const handleResourceClick = async (resource: ResilienceResource) => {
    // Track view
    try {
      await trackResourceView(resource.id);
    } catch (err) {

    }

    // Open URL if exists
    if (resource.url) {
      window.open(resource.url, '_blank', 'noopener,noreferrer');
    }
  };

  // Get unique resource types
  const resourceTypes = ['all', ...new Set(resources.map((r) => r.resource_type))];

  // Get unique categories from all resources
  const allCategories = new Set<string>();
  resources.forEach((r) => {
    r.categories?.forEach((cat) => allCategories.add(cat));
  });
  const categories = ['all', ...Array.from(allCategories)];

  // Filter resources
  const filteredResources = resources.filter((resource) => {
    if (selectedType !== 'all' && resource.resource_type !== selectedType) {
      return false;
    }
    if (selectedCategory !== 'all' && !resource.categories?.includes(selectedCategory)) {
      return false;
    }
    return true;
  });

  // Featured resources (always show at top)
  const featuredResources = filteredResources.filter((r) => r.featured);
  const otherResources = filteredResources.filter((r) => !r.featured);

  // Resource type icons
  const typeIcons: Record<string, string> = {
    hotline: '☎️',
    app: '📱',
    article: '📄',
    video: '🎥',
    podcast: '🎧',
    book: '📚',
    worksheet: '📝',
  };

  // Category display names
  const categoryNames: Record<string, string> = {
    all: 'All Categories',
    crisis_support: 'Crisis Support',
    mindfulness: 'Mindfulness',
    stress_management: 'Stress Management',
    self_care: 'Self-Care',
    communication: 'Communication',
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded-sm w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded-sm"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            <p className="font-medium">Failed to load resources</p>
            <p className="text-sm mt-1">{error}</p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={loadResources}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Retry
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Resource Library 📚</h2>
              <p className="text-gray-600">Crisis hotlines, apps, articles, and support resources</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Emergency Banner - Always Visible */}
          <div className="bg-red-50 border-l-4 border-red-600 p-4 mb-4">
            <div className="flex items-start gap-3">
              <span className="text-3xl">🆘</span>
              <div className="flex-1">
                <h3 className="font-bold text-red-900 mb-1">Crisis Support - Available 24/7</h3>
                <p className="text-sm text-red-800 mb-3">
                  If you're experiencing thoughts of self-harm or suicide, help is available right now.
                </p>
                <div className="flex gap-3 flex-wrap">
                  <a
                    href="tel:988"
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm"
                  >
                    Call 988 Suicide & Crisis Lifeline
                  </a>
                  <a
                    href="sms:988"
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium text-sm"
                  >
                    Text 988
                  </a>
                  <a
                    href="https://988lifeline.org/chat/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 border border-red-600 text-red-700 rounded-lg hover:bg-red-50 font-medium text-sm"
                  >
                    Chat Online
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-3">
            {/* Type filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Resource Type</label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {resourceTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                      selectedType === type
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span className="mr-2">{typeIcons[type] || '📋'}</span>
                    {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Category filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {categoryNames[cat] || cat.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Resources */}
        <div className="p-6">
          {filteredResources.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No resources found for this filter combination.</p>
              <button
                onClick={() => {
                  setSelectedType('all');
                  setSelectedCategory('all');
                }}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Featured Resources */}
              {featuredResources.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span>⭐</span> Featured Resources
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {featuredResources.map((resource) => (
                      <ResourceCard
                        key={resource.id}
                        resource={resource}
                        onClick={() => handleResourceClick(resource)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Other Resources */}
              {otherResources.length > 0 && (
                <div>
                  {featuredResources.length > 0 && (
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">All Resources</h3>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {otherResources.map((resource) => (
                      <ResourceCard
                        key={resource.id}
                        resource={resource}
                        onClick={() => handleResourceClick(resource)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {filteredResources.length} resource{filteredResources.length !== 1 ? 's' : ''} available
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Resource Card Component
// ============================================================================

interface ResourceCardProps {
  resource: ResilienceResource;
  onClick: () => void;
}

const ResourceCard: React.FC<ResourceCardProps> = ({ resource, onClick }) => {
  const typeIcons: Record<string, string> = {
    hotline: '☎️',
    app: '📱',
    article: '📄',
    video: '🎥',
    podcast: '🎧',
    book: '📚',
    worksheet: '📝',
  };

  const typeColors: Record<string, string> = {
    hotline: 'bg-red-100 text-red-800 border-red-200',
    app: 'bg-blue-100 text-blue-800 border-blue-200',
    article: 'bg-green-100 text-green-800 border-green-200',
    video: 'bg-purple-100 text-purple-800 border-purple-200',
    podcast: 'bg-orange-100 text-orange-800 border-orange-200',
    book: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    worksheet: 'bg-pink-100 text-pink-800 border-pink-200',
  };

  const isClickable = !!resource.url;

  return (
    <div
      className={`bg-white border-2 rounded-lg p-4 transition-all ${
        isClickable
          ? 'border-gray-200 hover:border-blue-400 hover:shadow-lg cursor-pointer'
          : 'border-gray-200'
      }`}
      onClick={isClickable ? onClick : undefined}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{typeIcons[resource.resource_type] || '📋'}</span>
          <span
            className={`px-2 py-1 rounded text-xs font-medium border ${
              typeColors[resource.resource_type] || 'bg-gray-100 text-gray-800 border-gray-200'
            }`}
          >
            {resource.resource_type}
          </span>
        </div>
        {resource.is_evidence_based && (
          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-sm font-medium">
            🔬 Evidence-Based
          </span>
        )}
      </div>

      <h3 className="font-bold text-gray-800 mb-2 line-clamp-2">{resource.title}</h3>

      <p className="text-sm text-gray-600 mb-3 line-clamp-3">{resource.description}</p>

      {/* Tags */}
      {resource.tags && resource.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {resource.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-1 bg-gray-100 text-gray-600 rounded-sm text-xs"
            >
              {tag}
            </span>
          ))}
          {resource.tags.length > 3 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-sm text-xs">
              +{resource.tags.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Action button */}
      {isClickable && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-blue-600 font-medium">
            {resource.resource_type === 'hotline' ? 'Call Now →' : 'View Resource →'}
          </span>
          {resource.view_count > 0 && (
            <span className="text-gray-500 text-xs">
              {resource.view_count} view{resource.view_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {!isClickable && resource.resource_type === 'hotline' && (
        <p className="text-xs text-gray-500 italic mt-2">
          Check your employee handbook for EAP contact information
        </p>
      )}
    </div>
  );
};

export default ResourceLibrary;
