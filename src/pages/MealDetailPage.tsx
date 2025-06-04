import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import ImageCarousel from '../components/ImageCarousel';
import PhotoUpload from '../components/PhotoUpload';
import PhotoGallery from '../components/PhotoGallery';
// Import your local recipe arrays
import recipesWeek1 from '../data/recipesWeek1';
import recipesWeek2 from '../data/recipesWeek2';
// ...import recipesWeek3, recipesWeek4, recipesBonus

const allRecipes = [
  ...recipesWeek1,
  ...recipesWeek2,
  // ...add week3, week4, bonus
];

interface Meal {
  id: string;
  name: string;
  description: string;
  image_url?: string | null;
  calories?: number | null;
  cost?: number | null;
  // Ensure it matches the 'meals' table structure for Supabase queries
}

const MealDetailPage: React.FC = () => { // Added React.FC
  const { id } = useParams<{ id: string }>(); // id will be string | undefined if not guaranteed by router
  const navigate = useNavigate();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false); // Stop loading if no id
      return;
    }
    const fetchMeal = async (): Promise<void> => { // Made into a named async function
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('meals')
          .select('*')
          .eq('id', id)
          .single<Meal>(); // Use generic type for single()

        if (error) {
          console.error('Error fetching meal:', error.message);
          setMeal(null);
        } else {
          setMeal(data);
        }
      } catch (e) {
        const error = e instanceof Error ? e : new Error("An unexpected error occurred");
        console.error('Unexpected error fetching meal:', error.message);
        setMeal(null);
      } finally {
        setLoading(false);
      }
    };
    fetchMeal();
  }, [id]);

  // Match recipe by name
  const recipe = meal
    ? allRecipes.find(
        (r) => r.name.trim().toLowerCase() === meal.name.trim().toLowerCase()
      )
    : null;

  return (
    <div className="bg-white text-[#003865] rounded-xl shadow-md p-4 sm:p-6 max-w-2xl mx-auto mt-8 space-y-6">
      <button
        onClick={() => navigate('/dashboard')}
        className="text-sm text-[#8cc63f] hover:underline"
      >
        ← Back to dashboard
      </button>

      {/* Loading state */}
      {loading && <p className="text-center mt-10">Loading…</p>}

      {/* Not‑found state */}
      {!loading && !meal && (
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold text-red-600">Meal not found.</p>
          <Link to="/dashboard" className="text-blue-500 underline">
            Back to dashboard
          </Link>
        </div>
      )}

      {/* Successful state */}
      {meal && (
        <>
          <h1 className="text-2xl font-bold text-center">{meal.name}</h1>

          {/* Carousel if images, else single img */}
          {recipe?.images?.length ? (
            <ImageCarousel images={recipe.images} altText={meal.name} />
          ) : (
            <img
              src={
                meal.image_url ||
                `https://source.unsplash.com/600x400/?${encodeURIComponent(
                  meal.name
                )}`
              }
              alt={meal.name}
              className="w-full h-64 object-cover rounded-lg shadow-md"
            />
          )}

          <div className="flex flex-wrap gap-4 text-sm font-medium">
            {meal.calories && <span>Calories: {meal.calories}</span>}
            {meal.cost && <span>Cost: ${meal.cost}</span>}
          </div>

          <p className="whitespace-pre-wrap leading-relaxed text-gray-700">
            {meal.description}
          </p>

          {/* Show full recipe if available */}
          {recipe && (
            <div>
              <h2 className="text-lg font-semibold mt-4">Ingredients</h2>
              <ul className="list-disc ml-6 text-base space-y-1">
                {recipe.ingredients.map((ing: string, idx: number) => (
                  <li key={idx}>{ing}</li>
                ))}
              </ul>

              <h2 className="text-lg font-semibold mt-4">Directions</h2>
              <ol className="list-decimal ml-6 text-base space-y-2">
                {recipe.steps.map((step: string, idx: number) => (
                  <li key={idx} className="mb-1">{step}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="space-y-4 mt-6">
            <PhotoUpload context="meal" recordId={meal.id} />
            <PhotoGallery context="meal" recordId={meal.id} />
          </div>
        </>
      )}
    </div>
  );
}

export default MealDetailPage;
