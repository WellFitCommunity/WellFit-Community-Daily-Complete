// src/components/IngredientList.tsx
import React from 'react';

interface IngredientListProps {
  ingredients: string[];
}

const IngredientList: React.FC<IngredientListProps> = ({ ingredients }) => {
  return (
    <ul className="list-disc ml-6 mt-2 space-y-1">
      {ingredients.map((item, index) => (
        <li key={index} className="text-base text-gray-800">{item}</li>
      ))}
    </ul>
  );
};

export default IngredientList;
