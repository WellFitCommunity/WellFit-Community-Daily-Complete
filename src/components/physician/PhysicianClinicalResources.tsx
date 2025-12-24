import React, { useState, useEffect } from 'react';
import { AlertTriangle, ClipboardList, Pill, Users, ExternalLink, Search, Filter } from 'lucide-react';
import { ResilienceHubService } from '../../services/resilienceHubService';
import type { ResilienceResource } from '../../types/nurseos';

// ============================================================================
// TYPES
// ============================================================================

type ResourceCategory = 'emergency_protocols' | 'clinical_guidelines' | 'formulary' | 'specialist_directory';

interface ResourceCategoryConfig {
  id: ResourceCategory;
  title: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const RESOURCE_CATEGORIES: ResourceCategoryConfig[] = [
  {
    id: 'emergency_protocols',
    title: 'Emergency Protocols',
    icon: <AlertTriangle className="w-5 h-5" />,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  {
    id: 'clinical_guidelines',
    title: 'Clinical Guidelines',
    icon: <ClipboardList className="w-5 h-5" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  {
    id: 'formulary',
    title: 'Formulary',
    icon: <Pill className="w-5 h-5" />,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  {
    id: 'specialist_directory',
    title: 'Specialist Directory',
    icon: <Users className="w-5 h-5" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200'
  }
];

// ============================================================================
// RESOURCE CARD COMPONENT
// ============================================================================

interface ResourceCardProps {
  resource: ResilienceResource;
  categoryConfig: ResourceCategoryConfig;
  onView: (resourceId: string) => void;
}

const ResourceCard: React.FC<ResourceCardProps> = ({ resource, categoryConfig, onView }) => {
  const handleClick = () => {
    onView(resource.id);
    if (resource.url) {
      window.open(resource.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className={`${categoryConfig.bgColor} ${categoryConfig.borderColor} border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer`}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={`${categoryConfig.color}`}>
          {categoryConfig.icon}
        </div>
        {resource.url && (
          <ExternalLink className={`w-4 h-4 ${categoryConfig.color}`} />
        )}
      </div>

      <h4 className="font-bold text-gray-900 mb-1">{resource.title}</h4>

      {resource.description && (
        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{resource.description}</p>
      )}

      {resource.is_evidence_based && (
        <span className="inline-block text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-sm">
          Evidence-Based
        </span>
      )}

      {resource.tags && resource.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {resource.tags.slice(0, 3).map((tag, idx) => (
            <span key={idx} className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-sm">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const PhysicianClinicalResources: React.FC = () => {
  const [resources, setResources] = useState<ResilienceResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<ResourceCategory | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadResources();
  }, []);

  const loadResources = async () => {
    try {
      setLoading(true);
      // Fetch resources with target_audience containing 'physician'
      const data = await ResilienceHubService.getResources();

      // Filter for physician-specific resources
      const physicianResources = data.filter(r =>
        r.target_audience?.includes('physician') ||
        r.target_audience?.includes('all_providers')
      );

      setResources(physicianResources);
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

  const handleViewResource = async (resourceId: string) => {
    try {
      await ResilienceHubService.trackResourceView(resourceId);
    } catch (error) {

    }
  };

  // Filter resources by category and search term
  const filteredResources = resources.filter(resource => {
    // Category filter
    if (selectedCategory !== 'all') {
      if (!resource.categories?.includes(selectedCategory)) {
        return false;
      }
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        resource.title.toLowerCase().includes(searchLower) ||
        resource.description?.toLowerCase().includes(searchLower) ||
        resource.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    return true;
  });

  // Group resources by category
  const resourcesByCategory: Record<ResourceCategory, ResilienceResource[]> = {
    emergency_protocols: filteredResources.filter(r => r.categories?.includes('emergency_protocols')),
    clinical_guidelines: filteredResources.filter(r => r.categories?.includes('clinical_guidelines')),
    formulary: filteredResources.filter(r => r.categories?.includes('formulary')),
    specialist_directory: filteredResources.filter(r => r.categories?.includes('specialist_directory'))
  };

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search resources..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-600" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as ResourceCategory | 'all')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            {RESOURCE_CATEGORIES.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading resources...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredResources.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <ClipboardList className="w-16 h-16 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600 font-medium">No resources found</p>
          <p className="text-sm text-gray-500 mt-1">
            {searchTerm
              ? 'Try adjusting your search or filter criteria'
              : 'Resources will appear here once added'}
          </p>
        </div>
      )}

      {/* Resources Grid by Category */}
      {!loading && selectedCategory === 'all' ? (
        // Show all categories when "All" is selected
        RESOURCE_CATEGORIES.map(categoryConfig => {
          const categoryResources = resourcesByCategory[categoryConfig.id];
          if (categoryResources.length === 0) return null;

          return (
            <div key={categoryConfig.id} className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={categoryConfig.color}>
                  {categoryConfig.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900">{categoryConfig.title}</h3>
                <span className="text-sm text-gray-500">({categoryResources.length})</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoryResources.map(resource => (
                  <ResourceCard
                    key={resource.id}
                    resource={resource}
                    categoryConfig={categoryConfig}
                    onView={handleViewResource}
                  />
                ))}
              </div>
            </div>
          );
        })
      ) : (
        // Show filtered category
        !loading && selectedCategory !== 'all' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredResources.map(resource => {
              const categoryConfig = RESOURCE_CATEGORIES.find(c => c.id === selectedCategory);
              if (!categoryConfig) return null;

              return (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  categoryConfig={categoryConfig}
                  onView={handleViewResource}
                />
              );
            })}
          </div>
        )
      )}
    </div>
  );
};

export default PhysicianClinicalResources;
