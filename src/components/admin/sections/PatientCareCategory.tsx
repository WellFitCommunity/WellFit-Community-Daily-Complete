/**
 * Patient Care & Engagement Category
 * Lazy-loaded category wrapper for patient care sections
 */

import React from 'react';
import { CategoryCollapsibleGroup } from '../CategoryCollapsibleGroup';
import { AdaptiveCollapsibleSection } from '../AdaptiveCollapsibleSection';
import { AnimatedSection } from '../LearningIndicator';
import { getSectionsByCategory } from './sectionDefinitions';

interface Props {
  userRole: string;
  defaultOpen?: boolean;
}

export const PatientCareCategory: React.FC<Props> = ({ userRole, defaultOpen = false }) => {
  const sections = getSectionsByCategory('patient-care');

  if (sections.length === 0) return null;

  return (
    <CategoryCollapsibleGroup
      categoryId="patient-care"
      title="Patient Care & Engagement"
      icon="🏥"
      headerColor="text-blue-800"
      defaultOpen={defaultOpen}
      userRole={userRole}
    >
      {sections.map((section, index) => (
        <AnimatedSection key={section.id} sectionId={section.id} index={index}>
          <AdaptiveCollapsibleSection
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
        </AnimatedSection>
      ))}
    </CategoryCollapsibleGroup>
  );
};

export default PatientCareCategory;
