// src/data/allRecipes.ts
// Single source of truth for the type
import type { Recipe } from './types';

import recipesWeek1 from './recipesWeek1';
import recipesWeek2 from './recipesWeek2';
import recipesWeek3 from './recipesWeek3';
import recipesWeek4 from './recipesWeek4';
import recipesBonus from './recipesBonus';

// Accept slightly "loose" shapes coming from week files (string OR string[])
type LooseRecipe = Omit<
  Recipe,
  'ingredients' | 'steps' | 'images' | 'calories' | 'cost' | 'cook_time' | 'cook_temp' | 'tags'
> & {
  ingredients?: string[] | string;
  steps?: string[] | string;
  images?: string[] | string;
  calories?: number | string | null;
  cost?: number | string | null;
  cook_time?: string | null | undefined;
  cook_temp?: string | null | undefined;
  tags?: string | null | undefined; // keep as a plain string (CSV) if present
};

function toArray(value?: string[] | string): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toNumberOrZero(value?: number | string | null): number {
  if (value == null || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toStringOrEmpty(value?: string | null): string {
  return typeof value === 'string' ? value : '';
}

function ensureId(recipes: LooseRecipe[], offset: number): Recipe[] {
  return recipes.map((r, i) => {
    const id = r.id != null ? String(r.id) : `recipe-${offset + i + 1}`;

    const images = toArray(r.images);
    const image_url = r.image_url ?? images[0];

    const steps = toArray(r.steps);
    const ingredients = toArray(r.ingredients);

    return {
      id,
      name: r.name,
      description: r.description ?? '',
      images,            // array form
      image_url,         // convenience primary image
      steps,
      ingredients,
      calories: toNumberOrZero(r.calories),
      cost: toNumberOrZero(r.cost),
      cook_time: toStringOrEmpty(r.cook_time), // ✅ guaranteed string
      cook_temp: toStringOrEmpty(r.cook_temp), // ✅ guaranteed string
      tags: r.tags ?? '',                       // keep as a single string (CSV) if you use it
    } as Recipe;
  });
}

export const allRecipes: Recipe[] = [
  ...ensureId(recipesWeek1 as unknown as LooseRecipe[], 0),
  ...ensureId(recipesWeek2 as unknown as LooseRecipe[], 100),
  ...ensureId(recipesWeek3 as unknown as LooseRecipe[], 200),
  ...ensureId(recipesWeek4 as unknown as LooseRecipe[], 300),
  ...ensureId(recipesBonus as unknown as LooseRecipe[], 400),
];

// OPTIONAL default export if you prefer default import style elsewhere
// export default allRecipes;
