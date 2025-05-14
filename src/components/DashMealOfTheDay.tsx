// src/components/DashMealOfTheDay.tsx
// Font size of the community‑upload prompt bumped from text-xs to text-base for better legibility.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

type Meal = { id: string; name: string };

type Props = {
  onSeeDetails?: (id: string | number) => void;
};

const DASH_INFO_URL =
  'https://www.nhlbi.nih.gov/education/dash-eating-plan';

export default function DashMealSuggestionCard({ onSeeDetails }: Props) {
  const navigate = useNavigate();
  const [meal, setMeal] = useState<Meal | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('meals')
        .select('id, name, created_at')
        .order('created_at', { ascending: true });

      if (!error && data?.length) {
        const idx =
          Math.floor(new Date().setHours(0, 0, 0, 0) / 86_400_000) % data.length;
        setMeal(data[idx]);
      }
    })();
  }, []);

  const goToDetail = (id: string | number) =>
    onSeeDetails ? onSeeDetails(id) : navigate(`/meal/${id}`);

  return (
    <div
      className="bg-white text-[#003865] rounded-xl shadow-md p-4 space-y-3 cursor-pointer hover:ring-2 hover:ring-[#8cc63f] transition"
      onClick={() => meal && goToDetail(meal.id)}
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
          <h3 className="mt-2 font-semibold">Today’s pick: {meal.name}</h3>

          {/* Larger font for the community-upload prompt */}
          <p className="text-base italic text-center text-[#003865] font-medium">
            Cooked this meal? Snap a photo and upload it on the next screen for
            a chance to be featured in the Community Daily app and possibly our
            website!
          </p>

          <button
            className="mt-2 w-full py-2 bg-[#003865] text-white font-semibold rounded hover:bg-[#8cc63f] transition"
            onClick={(e) => {
              e.stopPropagation();
              goToDetail(meal.id);
            }}
          >
            See Full Recipe
          </button>

          <a
            href={DASH_INFO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-2 text-center text-sm font-medium text-[#8cc63f] hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Learn more about the DASH plan ↗
          </a>
        </>
      ) : (
        <p className="text-sm text-muted-foreground mt-2">Loading meal…</p>
      )}
    </div>
  );
}

