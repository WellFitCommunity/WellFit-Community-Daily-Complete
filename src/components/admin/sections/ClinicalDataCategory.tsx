/**
 * Clinical Data & FHIR Category
 * Lazy-loaded category wrapper for clinical data sections
 */

import React from 'react';
import { CategoryCollapsibleGroup } from '../CategoryCollapsibleGroup';
import { AdaptiveCollapsibleSection } from '../AdaptiveCollapsibleSection';
import { getSectionsByCategory } from './sectionDefinitions';

interface Props {
  userRole: string;
  defaultOpen?: boolean;
}

export const ClinicalDataCategory: React.FC<Props> = ({ userRole, defaultOpen = false }) => {
  const sections = getSectionsByCategory('clinical');

  if (sections.length === 0) return null;

  return (
    <CategoryCollapsibleGroup
      categoryId="clinical"
      title="Clinical Data & FHIR"
      icon="🧬"
      headerColor="text-purple-800"
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

export default ClinicalDataCategory;
