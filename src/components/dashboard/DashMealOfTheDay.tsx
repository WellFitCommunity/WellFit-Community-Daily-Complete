// src/components/DashMealOfTheDay.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { allRecipes } from '../../data/allRecipes';

type Meal = {
  id: string;
  name: string;
  image_url?: string;
  preview?: string;
};

const DASH_INFO_URL = 'https://www.nhlbi.nih.gov/education/dash-eating-plan';

const DashMealOfTheDay: React.FC = () => {
  const navigate = useNavigate();
  const [meal, setMeal] = useState<Meal | null>(null);

  useEffect(() => {
    let canceled = false;
    (async () => {
      let mealData: Meal[] = [];
      try {
        const { data, error } = await supabase
          .from('meals')
          .select('id, name, image_url, preview, created_at')
          .order('created_at', { ascending: true });
        if (data && data.length) mealData = data;
      } catch {}
      // Fallback to static if no data
      if (!mealData.length) mealData = allRecipes;
      if (!canceled && mealData.length) {
        const idx =
          Math.floor(new Date().setHours(0, 0, 0, 0) / 86_400_000) % mealData.length;
        setMeal(mealData[idx]);
      }
    })();
    return () => { canceled = true; };
  }, []);

  const goToDetail = () => meal && navigate(`/meals/${meal.id}`);

  return (
    <div
      className="bg-white text-[#003865] rounded-xl shadow-md p-4 space-y-3 cursor-pointer hover:ring-2 hover:ring-[#8cc63f] transition"
      onClick={goToDetail}
      tabIndex={0}
      aria-label="DASH Meal of the Day"
      role="button"
    >
      <h2 className="text-xl font-bold">DASH Meal Suggestion</h2>
      <p className="text-sm italic text-[#003865]/80">
        DASH = Dietary Approaches to Stop Hypertension
      </p>
      <p className="text-sm mt-1">
        Designed to lower sodium while boosting potassium-rich foods, the DASH
        plan centers on colorful produce, whole grains, and lean proteins—
        powerful allies for healthy blood pressure. Today’s meal fits those
        guidelines perfectly.
      </p>

      {meal ? (
        <>
          {meal.image_url && (
            <img
              src={meal.image_url}
              alt={meal.name}
              className="w-full h-40 object-cover rounded-lg mb-2"
              style={{ maxHeight: '200px' }}
            />
          )}

          <h3 className="mt-2 font-semibold">Today’s pick: {meal.name}</h3>

          {meal.preview && (
            <p className="text-base text-gray-600">{meal.preview}</p>
          )}

          <p className="text-base italic text-center text-[#003865] font-medium">
            Cooked this meal? Snap a photo and upload it on the next screen for
            a chance to be featured in the Community Daily app and possibly our
            website!
          </p>

          <button
            className="mt-2 w-full py-2 bg-[#003865] text-white font-semibold rounded hover:bg-[#8cc63f] transition"
            onClick={e => {
              e.stopPropagation();
              goToDetail();
            }}
          >
            See Full Recipe
          </button>

          <a
            href={DASH_INFO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-2 text-center text-sm font-medium text-[#8cc63f] hover:underline"
            onClick={e => e.stopPropagation()}
          >
            Learn more about the DASH plan ↗
          </a>
        </>
      ) : (
        <p className="text-sm text-muted-foreground mt-2">Loading meal…</p>
      )}
    </div>
  );
};

export default DashMealOfTheDay;
