// src/components/DashMealOfTheDay.tsx
import React from 'react';

type DashMealOfTheDayProps = {
  onSeeDetails: (id: string | number) => void;
};

const DashMealOfTheDay: React.FC<DashMealOfTheDayProps> = ({ onSeeDetails }) => {
  // Example dummy meal data
  const meal = {
    id: 1,
    name: 'Grilled Chicken Salad',
    description: 'A heart-healthy salad with lean protein and fresh greens.'
  };

  return (
    <div className="space-y-2">
      <h3 className="text-xl font-bold">{meal.name}</h3>
      <p>{meal.description}</p>
      <button
        className="text-wellfit-blue underline hover:text-wellfit-green"
        onClick={() => onSeeDetails(meal.id)}
      >
        See Full Recipe
      </button>
    </div>
  );
};

export default DashMealOfTheDay;
