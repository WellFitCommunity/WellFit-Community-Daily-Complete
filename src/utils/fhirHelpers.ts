/**
 * FHIR R4 Helper Utilities
 * Utilities for working with FHIR array-based fields in UI components
 */

import type { Condition } from '../types/fhir';

/**
 * Get the primary category from a category array
 * Returns first category or undefined if array is empty
 */
export function getPrimaryCategory(categories?: string[]): string | undefined {
  return categories?.[0];
}

/**
 * Set a single category value (converts to array for FHIR)
 */
export function setCategory(categoryValue: string): string[] {
  return [categoryValue];
}

/**
 * Check if a category array includes a specific value
 */
export function hasCategory(categories: string[] | undefined, value: string): boolean {
  return categories?.includes(value) ?? false;
}

/**
 * Add a category to an existing array (if not already present)
 */
export function addCategory(categories: string[] | undefined, value: string): string[] {
  const existing = categories || [];
  return existing.includes(value) ? existing : [...existing, value];
}

/**
 * Remove a category from an array
 */
export function removeCategory(categories: string[] | undefined, value: string): string[] {
  return (categories || []).filter(c => c !== value);
}

/**
 * Format category array for display (comma-separated)
 */
export function formatCategories(categories?: string[]): string {
  return categories?.join(', ') || '';
}

/**
 * Get category display label from value
 */
export function getCategoryLabel(value: string): string {
  const labels: Record<string, string> = {
    'problem-list-item': 'Problem List',
    'encounter-diagnosis': 'Encounter Diagnosis',
    'health-concern': 'Health Concern',
  };
  return labels[value] || value;
}

/**
 * Format categories for display with labels
 */
export function formatCategoriesWithLabels(categories?: string[]): string {
  return categories?.map(getCategoryLabel).join(', ') || '';
}
