/**
 * Security & Compliance Category
 * Lazy-loaded category wrapper for security sections
 */

import React from 'react';
import { CategoryCollapsibleGroup } from '../CategoryCollapsibleGroup';
import { AdaptiveCollapsibleSection } from '../AdaptiveCollapsibleSection';
import { getSectionsByCategory } from './sectionDefinitions';

interface Props {
  userRole: string;
  defaultOpen?: boolean;
}

export const SecurityComplianceCategory: React.FC<Props> = ({ userRole, defaultOpen = false }) => {
  const sections = getSectionsByCategory('security');

  if (sections.length === 0) return null;

  return (
    <CategoryCollapsibleGroup
      categoryId="security"
      title="Security & Compliance"
      icon="🛡️"
      headerColor="text-red-800"
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

export default SecurityComplianceCategory;
