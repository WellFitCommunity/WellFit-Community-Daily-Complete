// src/pages/MealDetailPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import PhotoUpload from '../components/PhotoUpload';
import PhotoGallery from '../components/PhotoGallery';

type Meal = {
  id: string;
  name: string;
  description: string;
  image_url?: string;
};

const MealDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchMeal = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('meals')
        .select('id,name,description,image_url')
        .eq('id', id)
        .single();
      if (error) {
        console.error('Error fetching meal:', error.message);
      } else {
        setMeal(data);
      }
      setLoading(false);
    };
    fetchMeal();
  }, [id]);

  if (loading) {
    return <p className="text-center text-gray-600">Loading...</p>;
  }

  if (!meal) {
    return <p className="text-center text-gray-600">No meal found.</p>;
  }

  // Use stored image_url or fallback to Unsplash
  const imgSrc = meal.image_url
    ? meal.image_url
    : `https://source.unsplash.com/600x400/?${encodeURIComponent(meal.name)}`;

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-center text-wellfit-blue">{meal.name}</h1>
      <img
        src={imgSrc}
        alt={meal.name}
        className="w-full h-64 object-cover rounded-lg shadow-md"
      />
      <p className="text-gray-700">{meal.description}</p>

      {/* Photo upload and gallery */}
      <div className="space-y-4">
        <PhotoUpload context="meal" recordId={meal.id} />
        <PhotoGallery context="meal" recordId={meal.id} />
      </div>
    </div>
  );
};

export default MealDetailPage;
