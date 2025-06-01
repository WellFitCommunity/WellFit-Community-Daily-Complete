import recipesWeek1 from './recipesWeek1';
import recipesWeek2 from './recipesWeek2';
import recipesWeek3 from './recipesWeek3';
import recipesWeek4 from './recipesWeek4';
import recipesBonus from './recipesBonus';

function ensureId(recipes: any[], offset: number) {
  // Add a unique ID if missing (combines week index and index in that week)
  return recipes.map((r, i) => ({
    ...r,
    id: r.id || `recipe-${offset + i + 1}`,
    image_url: r.images?.[0],   // always add image_url for preview card
    preview: r.steps?.[0]?.substring(0, 64) + '...',
  }));
}

export const allRecipes = [
  ...ensureId(recipesWeek1, 0),
  ...ensureId(recipesWeek2, 100),
  ...ensureId(recipesWeek3, 200),
  ...ensureId(recipesWeek4, 300),
  ...ensureId(recipesBonus, 400),
];
