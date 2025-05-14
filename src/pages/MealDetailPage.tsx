// src/pages/MealDetailPage.tsx
// Renders white card even during loading / not‑found states.

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import PhotoUpload from '../components/PhotoUpload';
import PhotoGallery from '../components/PhotoGallery';

interface Meal {
  id: string;
  name: string;
  description: string;
  image_url?: string | null;
  calories?: number | null;
  cost?: number | null;
}

export default function MealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    (async () => {
      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .eq('id', id)
        .single();

      if (error) console.error('Error fetching meal:', error.message);
      setMeal(data as Meal | null);
      setLoading(false);
    })();
  }, [id]);

  // Helper: image source fallback
  const getImgSrc = (m: Meal) =>
    m.image_url ||
    `https://source.unsplash.com/600x400/?${encodeURIComponent(m.name)}`;

  return (
    <div className="bg-white text-[#003865] rounded-xl shadow-md p-6 max-w-2xl mx-auto mt-8 space-y-6">
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

          <img
            src={getImgSrc(meal)}
            alt={meal.name}
            className="w-full h-64 object-cover rounded-lg shadow-md"
          />

          <div className="flex flex-wrap gap-4 text-sm font-medium">
            {meal.calories && <span>Calories: {meal.calories}</span>}
            {meal.cost && <span>Cost: ${meal.cost}</span>}
          </div>

          <p className="whitespace-pre-wrap leading-relaxed text-gray-700">
            {meal.description}
          </p>

          <div className="space-y-4">
            <PhotoUpload context="meal" recordId={meal.id} />
            <PhotoGallery context="meal" recordId={meal.id} />
          </div>
        </>
      )}
    </div>
  );
}
