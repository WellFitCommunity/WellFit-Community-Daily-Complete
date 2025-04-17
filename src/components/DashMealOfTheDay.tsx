import React from 'react';

const dashMeals = [
  {
    name: "Grilled Salmon with Quinoa",
    calories: 450,
    cost: "$7.25",
    cookTime: "20 minutes",
    description: "A heart-healthy dish packed with Omega-3s and fiber-rich quinoa."
  },
  {
    name: "Turkey Lettuce Wraps",
    calories: 320,
    cost: "$4.50",
    cookTime: "15 minutes",
    description: "Low-carb wraps with lean ground turkey and crunchy vegetables."
  },
  {
    name: "Veggie Stir Fry with Brown Rice",
    calories: 400,
    cost: "$5.60",
    cookTime: "25 minutes",
    description: "Colorful vegetables sautéed in olive oil served over brown rice."
  },
  {
    name: "Baked Chicken with Sweet Potato",
    calories: 480,
    cost: "$6.80",
    cookTime: "35 minutes",
    description: "Lean protein and fiber-packed sweet potato make this a filling option."
  },
  {
    name: "Spinach & Feta Omelet",
    calories: 280,
    cost: "$3.90",
    cookTime: "10 minutes",
    description: "Quick, protein-rich breakfast with leafy greens and cheese."
  }
];

const DashMealOfTheDay = () => {
  const today = new Date().getDate();
  const meal = dashMeals[today % dashMeals.length];
  return (
    <section className="bg-white border-2 border-[#8cc63f] p-4 rounded-xl shadow">
      <h2 className="text-xl font-semibold text-[#003865] mb-2">DASH Meal of the Day</h2>
      <p className="text-gray-900 font-bold">{meal.name}</p>
      <p className="text-gray-700">{meal.description}</p>
      <ul className="text-sm text-gray-600 mt-2">
        <li><strong>Calories:</strong> {meal.calories}</li>
        <li><strong>Cost:</strong> {meal.cost}</li>
        <li><strong>Cook Time:</strong> {meal.cookTime}</li>
      </ul>
      <div className="mt-4 text-xs text-gray-500">
        <p><strong>What is the DASH diet?</strong> DASH stands for Dietary Approaches to Stop Hypertension. It's a flexible and balanced eating plan proven to help lower blood pressure and support heart health.</p>
      </div>
    </section>
  );
};

export default DashMealOfTheDay;
