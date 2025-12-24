// src/pages/MealDetailPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import PhotoUpload from '../components/features/PhotoUpload';
import PhotoGallery from '../components/features/PhotoGallery';
import { useSupabaseClient, useUser } from '../contexts/AuthContext';
import { submitMealInteraction, uploadMealPhoto, getUserMealInteraction } from '../services/mealInteractionService';

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

// Change this to 'supabase' later when MealsService is ready.
// You can also drive this with import.meta.env.VITE_MEALS_SOURCE.
const MEALS_SOURCE: 'local' | 'supabase' =
  (import.meta.env.VITE_MEALS_SOURCE as 'local' | 'supabase') || 'local';

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
  const supabase = useSupabaseClient();
  const user = useUser();

  const [loading, setLoading] = useState<boolean>(MEALS_SOURCE === 'supabase');
  const [recipe, setRecipe] = useState<Recipe | null>(() =>
    MEALS_SOURCE === 'local' ? normalizeFromLocalById(id) : null
  );

  // Meal interaction state
  const [showInteractionPrompt, setShowInteractionPrompt] = useState(false);
  const [interactionId, setInteractionId] = useState<string | null>(null);
  const [userResponse, setUserResponse] = useState<boolean | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [interactionMessage, setInteractionMessage] = useState('');

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

  // Track meal view for engagement reporting
  useEffect(() => {
    const trackMealView = async () => {
      if (!recipe?.id) return;

      try {
        // Get session to ensure user_id matches auth.uid() for RLS
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;

        const userId = session.user.id;

        // Get user's tenant_id from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('user_id', userId)
          .single();

        if (profile?.tenant_id) {
          await supabase.from('feature_engagement').insert({
            user_id: userId,
            tenant_id: profile.tenant_id,
            feature_type: 'meal_view',
            feature_id: recipe.id,
            metadata: { meal_name: recipe.name }
          });
        }
      } catch {
        // Silently fail - engagement tracking is not critical
      }
    };

    // Only track once per session per meal
    const viewKey = `meal-viewed-${id}`;
    if (recipe && !sessionStorage.getItem(viewKey)) {
      sessionStorage.setItem(viewKey, 'true');
      trackMealView();
    }
  }, [recipe, supabase, id]);

  // Check if user already interacted with this meal
  useEffect(() => {
    if (!user?.id || !id) return;

    const checkInteraction = async () => {
      const { data } = await getUserMealInteraction(supabase, user.id, id);
      if (data) {
        setUserResponse(data.will_make_it);
        setInteractionId(data.id);
        setShowInteractionPrompt(false);
      } else {
        // Show prompt after 3 seconds if not already responded
        setTimeout(() => setShowInteractionPrompt(true), 3000);
      }
    };

    checkInteraction();
  }, [user?.id, id, supabase]);

  // Handle meal interaction response
  const handleMealResponse = async (willMakeIt: boolean) => {
    if (!user?.id || !recipe) return;

    try {
      const { data, error } = await submitMealInteraction(supabase, {
        user_id: user.id,
        meal_id: recipe.id,
        meal_name: recipe.name,
        will_make_it: willMakeIt
      });

      if (error) throw error;

      setUserResponse(willMakeIt);
      setInteractionId(data.id);
      setShowInteractionPrompt(false);

      if (willMakeIt) {
        setInteractionMessage('Great! Consider uploading a photo when you make it to be featured!');
        setTimeout(() => setInteractionMessage(''), 5000);
      } else {
        setInteractionMessage('Thanks for letting us know!');
        setTimeout(() => setInteractionMessage(''), 3000);
      }
    } catch (error) {

    }
  };

  // Handle photo upload
  const handlePhotoUpload = async () => {
    if (!photoFile || !interactionId || !user?.id) return;

    setUploadingPhoto(true);
    try {
      const { error } = await uploadMealPhoto(supabase, {
        interaction_id: interactionId,
        photo_file: photoFile,
        user_id: user.id
      });

      if (error) throw error;

      setInteractionMessage('🎉 Photo uploaded! You may be featured on the website or in Community Moments!');
      setPhotoFile(null);
      setTimeout(() => setInteractionMessage(''), 5000);
    } catch (error) {

      setInteractionMessage('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

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
          <div className="h-6 bg-gray-200 rounded-sm w-2/3 mx-auto" />
          <div className="w-full h-64 bg-gray-200 rounded-lg" />
          <div className="h-4 bg-gray-200 rounded-sm w-1/3" />
          <div className="h-4 bg-gray-200 rounded-sm w-1/2" />
          <div className="h-4 bg-gray-200 rounded-sm w-1/4" />
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

          {/* Meal Interaction Prompt */}
          {showInteractionPrompt && user && (
            <div className="mt-6 p-6 bg-linear-to-r from-blue-50 to-green-50 border-2 border-[#8cc63f] rounded-xl shadow-lg relative z-10">
              <h3 className="text-xl font-bold text-[#003865] mb-4 text-center">
                🍽️ Will you be making this meal?
              </h3>
              <div className="flex gap-4 justify-center">
                <button
                  type="button"
                  onClick={() => handleMealResponse(true)}
                  className="px-8 py-4 bg-[#8cc63f] text-white font-bold text-lg rounded-lg hover:bg-[#77aa36] transition shadow-md active:scale-95 cursor-pointer touch-manipulation"
                >
                  Yes! 😊
                </button>
                <button
                  type="button"
                  onClick={() => handleMealResponse(false)}
                  className="px-8 py-4 bg-gray-400 text-white font-bold text-lg rounded-lg hover:bg-gray-500 transition shadow-md active:scale-95 cursor-pointer touch-manipulation"
                >
                  Not this time
                </button>
              </div>
            </div>
          )}

          {/* Photo Upload Section (if user said yes) */}
          {userResponse === true && interactionId && (
            <div className="mt-6 p-6 bg-yellow-50 border-2 border-yellow-400 rounded-xl">
              <h3 className="text-lg font-bold text-[#003865] mb-3">
                📸 Share Your Creation!
              </h3>
              <p className="text-gray-700 mb-4">
                Upload a photo of your meal to be featured on our website or in Community Moments!
              </p>
              <div className="space-y-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#8cc63f] file:text-white hover:file:bg-[#77aa36]"
                />
                <button
                  onClick={handlePhotoUpload}
                  disabled={!photoFile || uploadingPhoto}
                  className="w-full px-6 py-3 bg-[#003865] text-white font-bold rounded-lg hover:bg-[#8cc63f] transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {uploadingPhoto ? 'Uploading...' : 'Upload Photo 📤'}
                </button>
              </div>
            </div>
          )}

          {/* Interaction Messages */}
          {interactionMessage && (
            <div className="mt-4 p-4 bg-green-100 border border-green-400 text-green-800 rounded-lg text-center font-semibold">
              {interactionMessage}
            </div>
          )}
        </>
      )}
    </div>
  );
}
