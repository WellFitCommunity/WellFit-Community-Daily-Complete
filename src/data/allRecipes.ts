import recipesWeek1 from './recipesWeek1';
import recipesWeek2 from './recipesWeek2';
import recipesWeek3 from './recipesWeek3';
import recipesWeek4 from './recipesWeek4';
import recipesBonus from './recipesBonus';

// (Optional) define a light type so TS helps you catch typos
type Recipe = {
  id?: string | number;
  name: string;
  description?: string;
  images?: string[];
  image_url?: string;
  steps?: string[];
  calories?: number | null;
  cost?: number | null;
  ingredients?: string[];
  // preview?: string; // we'll add it below
};

function ensureId(recipes: Recipe[], offset: number) {
  return recipes.map((r, i) => {
    const id = r.id != null ? String(r.id) : `recipe-${offset + i + 1}`;
    const primaryImage = r.image_url ?? r.images?.[0]; // PRESERVE existing image_url
    const firstStep = r.steps?.[0];
    const preview = firstStep ? `${firstStep.slice(0, 64)}...` : undefined;

    return {
      ...r,
      id,
      image_url: primaryImage,
      ...(preview ? { preview } : {}), // only add if defined
    };
  });
}

export const allRecipes = [
  ...ensureId(recipesWeek1, 0),
  ...ensureId(recipesWeek2, 100),
  ...ensureId(recipesWeek3, 200),
  ...ensureId(recipesWeek4, 300),
  ...ensureId(recipesBonus, 400),
];

// OPTIONAL: uncomment if you want default import style elsewhere
// export default allRecipes;
