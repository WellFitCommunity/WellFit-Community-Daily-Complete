import { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
// import ImageCarousel from '../components/ui/ImageCarousel';
import PhotoUpload from '../../components/features/PhotoUpload';
// import PhotoGallery from '../components/features/PhotoGallery';
import { allRecipes } from '../../data/allRecipes';
import ImageCarousel from 'components/ui/ImageCarousel';
import PhotoGallery from 'components/features/PhotoGallery';

export default function MealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const recipe = useMemo(() => {
    if (!id) return null;
    return allRecipes.find((r: any) => String(r.id) === String(id)) || null;
  }, [id]);

  const meal = recipe
    ? {
        id: String(recipe.id),
        name: recipe.name,
        description: recipe.description || '',
        image_url: recipe.image_url || recipe.images?.[0] || null,
        calories: recipe.calories ?? null,
        cost: recipe.cost ?? null,
        images: recipe.images || [],
        ingredients: recipe.ingredients || [],
        steps: recipe.steps || [],
      }
    : null;

  return (
    <div className="bg-white text-[#003865] rounded-xl shadow-md p-4 sm:p-6 max-w-2xl mx-auto mt-8 space-y-6">
      <button
        onClick={() => navigate('/dashboard')}
        className="text-sm text-[#8cc63f] hover:underline"
      >
        ← Back to dashboard
      </button>

      {!meal && (
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold text-red-600">Meal not found.</p>
          <Link to="/dashboard" className="text-blue-500 underline">
            Back to dashboard
          </Link>
        </div>
      )}

      {meal && (
        <>
          <h1 className="text-2xl font-bold text-center">{meal.name}</h1>

          {meal.images.length ? (
            <ImageCarousel images={meal.images} altText={meal.name} />
          ) : (
            <img
              src={
                meal.image_url ||
                `https://source.unsplash.com/600x400/?${encodeURIComponent(meal.name)}`
              }
              alt={meal.name}
              className="w-full h-64 object-cover rounded-lg shadow-md"
            />
          )}

          <div className="flex flex-wrap gap-4 text-sm font-medium">
            {meal.calories ? <span>Calories: {meal.calories}</span> : null}
            {meal.cost ? <span>Cost: ${meal.cost}</span> : null}
          </div>

          <p className="whitespace-pre-wrap leading-relaxed text-gray-700">
            {meal.description || 'Enjoy your meal!'}
          </p>

          {meal.ingredients.length > 0 && (
            <>
              <h2 className="text-lg font-semibold mt-4">Ingredients</h2>
              <ul className="list-disc ml-6 text-base space-y-1">
                {meal.ingredients.map((ing: string, idx: number) => (
                  <li key={idx}>{ing}</li>
                ))}
              </ul>
            </>
          )}

          {meal.steps.length > 0 && (
            <>
              <h2 className="text-lg font-semibold mt-4">Directions</h2>
              <ol className="list-decimal ml-6 text-base space-y-2">
                {meal.steps.map((step: string, idx: number) => (
                  <li key={idx} className="mb-1">{step}</li>
                ))}
              </ol>
            </>
          )}

          {/* Photos remain tied to this recipe's id */}
          <div className="space-y-4 mt-6">
            <PhotoUpload context="meal" recordId={meal.id} />
            <PhotoGallery context="meal" recordId={meal.id} />
          </div>
        </>
      )}
    </div>
  );
}
