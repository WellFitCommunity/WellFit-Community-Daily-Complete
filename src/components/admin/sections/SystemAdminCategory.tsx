/**
 * System Administration Category
 * Lazy-loaded category wrapper for system admin sections
 */

import React from 'react';
import { CategoryCollapsibleGroup } from '../CategoryCollapsibleGroup';
import { AdaptiveCollapsibleSection } from '../AdaptiveCollapsibleSection';
import { getSectionsByCategory } from './sectionDefinitions';

interface Props {
  userRole: string;
  defaultOpen?: boolean;
}

export const SystemAdminCategory: React.FC<Props> = ({ userRole, defaultOpen = false }) => {
  const sections = getSectionsByCategory('admin');

  if (sections.length === 0) return null;

  return (
    <CategoryCollapsibleGroup
      categoryId="admin"
      title="System Administration"
      icon="⚙️"
      headerColor="text-gray-800"
      defaultOpen={defaultOpen}
      userRole={userRole}
    >
      {sections.map((section) => (
        <AdaptiveCollapsibleSection
          key={section.id}
          sectionId={section.id}
          title={section.title}
          subtitle={section.subtitle}
          icon={section.icon}
          headerColor={section.headerColor}
          userRole={userRole}
          priority={section.priority}
          defaultOpen={section.defaultOpen}
        >
          {section.component}
        </AdaptiveCollapsibleSection>
      ))}
    </CategoryCollapsibleGroup>
  );
};

export default SystemAdminCategory;
