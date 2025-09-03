// src/pages/MealDetailPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import PhotoUpload from '../components/features/PhotoUpload';
import PhotoGallery from '../components/features/PhotoGallery';

// Local data (today's source of truth)
import { allRecipes } from '../data/allRecipes';

// Optional hybrid source (future-proof): when you wire this up, uncomment the import
// and the fetch call guarded by the feature flag below.
// import { getMealById } from '../services/MealsService';

type Recipe = {
  id: string;
  name: string;
  description?: string;
  image_url?: string | null;
  images?: string[];
  calories?: number | null;
  cost?: number | null;
  ingredients?: string[];
  steps?: string[];
};

const WELLFIT_BLUE = '#003865';
const WELLFIT_GREEN = '#8cc63f';

// Change this to 'supabase' later when MealsService is ready.
// You can also drive this with process.env.REACT_APP_MEALS_SOURCE.
const MEALS_SOURCE: 'local' | 'supabase' =
  (process.env.REACT_APP_MEALS_SOURCE as 'local' | 'supabase') || 'local';

// If Unsplash is blocked by CSP, swap this to a WellFit-hosted asset.
const DEFAULT_IMAGE = 'https://example.com/default-meal.jpg';

function currency(n: number | null | undefined): string | null {
  if (typeof n !== 'number') return null;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function normalizeFromLocalById(id?: string | undefined): Recipe | null {
  if (!id) return null;
  const r: any = allRecipes.find((x: any) => String(x.id) === String(id));
  if (!r) return null;
  return {
    id: String(r.id),
    name: r.name,
    description: r.description || '',
    image_url: r.image_url || (Array.isArray(r.images) ? r.images[0] : null),
    images: Array.isArray(r.images) ? r.images : [],
    calories: typeof r.calories === 'number' ? r.calories : null,
    cost: typeof r.cost === 'number' ? r.cost : null,
    ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
    steps: Array.isArray(r.steps) ? r.steps : [],
  };
}

export default function MealDetailPage() {
  const params = useParams();
  const id = params?.id ? String(params.id) : undefined;

  const navigate = useNavigate();
  const location = useLocation();
  const backTo = (location.state as any)?.from ?? '/dashboard';

  const [loading, setLoading] = useState<boolean>(MEALS_SOURCE === 'supabase');
  const [recipe, setRecipe] = useState<Recipe | null>(() =>
    MEALS_SOURCE === 'local' ? normalizeFromLocalById(id) : null
  );

  // On mount or id/source change, fetch from the selected source.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) {
        setRecipe(null);
        setLoading(false);
        return;
      }

      if (MEALS_SOURCE === 'local') {
        setRecipe(normalizeFromLocalById(id));
        setLoading(false);
        return;
      }

      // HYBRID (Supabase) path — guarded; fallback to local if not found.
      try {
        setLoading(true);

        // Uncomment when MealsService exists:
        // const dbMeal = await getMealById(id);
        // if (!cancelled && dbMeal) {
        //   setRecipe({
        //     id: String(dbMeal.id),
        //     name: dbMeal.name,
        //     description: '', // add if you add description to the table later
        //     image_url: dbMeal.image_url || null,
        //     images: [], // you can connect Supabase storage later
        //     calories: typeof dbMeal.calories === 'number' ? dbMeal.calories : null,
        //     cost: typeof dbMeal.cost === 'number' ? dbMeal.cost : null,
        //     ingredients: Array.isArray(dbMeal.ingredients) ? dbMeal.ingredients : [],
        //     steps: Array.isArray(dbMeal.steps) ? dbMeal.steps : [],
        //   });
        //   setLoading(false);
        //   return;
        // }

        // Fallback (local) if Supabase not wired or not found:
        if (!cancelled) {
          setRecipe(normalizeFromLocalById(id));
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setRecipe(normalizeFromLocalById(id));
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // For SEO/readability, derive a title (safe to no-op if not using react-helmet)
  useEffect(() => {
    if (recipe?.name) {
      document.title = `${recipe.name} • WellFit Community`;
    }
    return () => {
      document.title = 'WellFit Community';
    };
  }, [recipe?.name]);

  const mainImage = useMemo(() => {
    if (recipe?.image_url) return recipe.image_url;
    if (recipe?.name)
      return `https://source.unsplash.com/600x400/?${encodeURIComponent(recipe.name)}`;
    return DEFAULT_IMAGE;
  }, [recipe?.image_url, recipe?.name]);

  return (
    <div className="bg-white text-[#003865] rounded-xl shadow-md p-4 sm:p-6 max-w-2xl mx-auto mt-8 space-y-6">
      <button
        onClick={() => navigate(backTo)}
        className="text-sm text-[#8cc63f] hover:underline"
        aria-label="Go back"
      >
        ← Back
      </button>

      {loading ? (
        <div role="status" aria-live="polite" className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-2/3 mx-auto" />
          <div className="w-full h-64 bg-gray-200 rounded-lg" />
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-1/4" />
        </div>
      ) : !recipe ? (
        <div className="text-center space-y-3" aria-live="polite">
          <p className="text-lg font-semibold text-red-600">Meal not found.</p>
          <Link to="/dashboard" className="text-blue-500 underline">
            Back to dashboard
          </Link>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-center">{recipe.name}</h1>

          {/* Image */}
          <img
            src={mainImage}
            alt={recipe.name}
            className="w-full h-64 object-cover rounded-lg shadow-md"
            loading="lazy"
          />

          {/* Photos tied to this recipe's id */}
          <div className="space-y-4 mt-6">
            <PhotoUpload context="meal" recordId={recipe.id} />
            <PhotoGallery context="meal" recordId={recipe.id} />
          </div>

          <div className="flex flex-wrap gap-4 text-sm font-medium">
            {typeof recipe.calories === 'number' && (
              <span>Calories: {recipe.calories}</span>
            )}
            {typeof recipe.cost === 'number' && (
              <span>Cost: {currency(recipe.cost)}</span>
            )}
          </div>

          {recipe.description && (
            <p className="whitespace-pre-wrap leading-relaxed text-gray-700">
              {recipe.description}
            </p>
          )}

          {Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 && (
            <>
              <h2 className="text-lg font-semibold mt-4">Ingredients</h2>
              <ul className="list-disc ml-6 text-base space-y-1">
                {recipe.ingredients.map((ing, idx) => (
                  <li key={idx}>{ing}</li>
                ))}
              </ul>
            </>
          )}

          {Array.isArray(recipe.steps) && recipe.steps.length > 0 && (
            <>
              <h2 className="text-lg font-semibold mt-4">Directions</h2>
              <ol className="list-decimal ml-6 text-base space-y-2">
                {recipe.steps.map((step, idx) => (
                  <li key={idx} className="mb-1">
                    {step}
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </div>
  );
}
