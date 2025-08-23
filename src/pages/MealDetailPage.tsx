// src/pages/MealDetailPage.tsx
import React, { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { allRecipes } from '../data/allRecipes';
import PhotoUpload from '../components/features/PhotoUpload';
import PhotoGallery from '../components/features/PhotoGallery';
// (Skip ImageCarousel for now to keep things simple.)


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

export default function MealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const recipe: Recipe | null = useMemo(() => {
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
  }, [id]);

  return (
    <div className="bg-white text-[#003865] rounded-xl shadow-md p-4 sm:p-6 max-w-2xl mx-auto mt-8 space-y-6">
      <button
        onClick={() => navigate('/dashboard')}
        className="text-sm text-[#8cc63f] hover:underline"
      >
        ← Back to dashboard
      </button>

      {!recipe ? (
        <div className="text-center space-y-3">
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
        src={
          recipe.image_url ||
          `https://source.unsplash.com/600x400/?${encodeURIComponent(recipe.name)}`
        }
        alt={recipe.name}
        className="w-full h-64 object-cover rounded-lg shadow-md"
      />

      {/* Photos tied to this recipe's id */}
      <div className="space-y-4 mt-6">
        <PhotoUpload context="meal" recordId={recipe.id} />
        <PhotoGallery context="meal" recordId={recipe.id} />
      </div>


          <div className="flex flex-wrap gap-4 text-sm font-medium">
            {recipe.calories !== null && <span>Calories: {recipe.calories}</span>}
            {recipe.cost !== null && <span>Cost: ${recipe.cost}</span>}
          </div>

          {recipe.description && (
            <p className="whitespace-pre-wrap leading-relaxed text-gray-700">
              {recipe.description}
            </p>
          )}

          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <>
              <h2 className="text-lg font-semibold mt-4">Ingredients</h2>
              <ul className="list-disc ml-6 text-base space-y-1">
                {recipe.ingredients.map((ing, idx) => (
                  <li key={idx}>{ing}</li>
                ))}
              </ul>
            </>
          )}

          {recipe.steps && recipe.steps.length > 0 && (
            <>
              <h2 className="text-lg font-semibold mt-4">Directions</h2>
              <ol className="list-decimal ml-6 text-base space-y-2">
                {recipe.steps.map((step, idx) => (
                  <li key={idx} className="mb-1">{step}</li>
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </div>
  );
}
