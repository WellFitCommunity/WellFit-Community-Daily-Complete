import React from 'react';

 export interface Meal {
  name: string;
  calories: number;
  cost: string;
  cookTime: string;
  description: string;
}

const dashMeals: Meal[] = [
  { name: "Grilled Salmon with Quinoa", calories: 450, cost: "$7.25", cookTime: "20 min", description: "Omega‑3 rich fish over fiber‑packed quinoa." },
  { name: "Turkey Lettuce Wraps", calories: 320, cost: "$4.50", cookTime: "15 min", description: "Lean turkey and crisp veggies in lettuce cups." },
  { name: "Veggie Stir Fry with Brown Rice", calories: 400, cost: "$5.60", cookTime: "25 min", description: "Colorful veggies in olive oil over brown rice." },
  { name: "Baked Chicken & Sweet Potato", calories: 480, cost: "$6.80", cookTime: "35 min", description: "Lean protein with fiber‑rich sweet potato." },
  { name: "Spinach & Feta Omelet", calories: 280, cost: "$3.90", cookTime: "10 min", description: "Protein‑packed eggs with leafy greens." },
  { name: "Chickpea & Avocado Salad", calories: 350, cost: "$4.75", cookTime: "10 min", description: "Fiber and healthy fats in one bowl." },
  { name: "Baked Cod with Asparagus", calories: 420, cost: "$6.00", cookTime: "22 min", description: "Lean white fish and crisp asparagus." },
  { name: "Tofu & Vegetable Curry", calories: 390, cost: "$5.25", cookTime: "30 min", description: "Plant‑based protein in a flavorful curry." },
  { name: "Lentil Soup with Whole‑Grain Bread", calories: 330, cost: "$3.50", cookTime: "40 min", description: "Hearty lentils with fiber‑rich bread." },
  { name: "Greek Yogurt Parfait", calories: 240, cost: "$2.80", cookTime: "5 min", description: "Probiotic yogurt with fruit and nuts." },
  { name: "Whole‑Wheat Pasta Primavera", calories: 460, cost: "$5.90", cookTime: "25 min", description: "Veggies and pasta in a light olive oil sauce." },
  { name: "Turkey Meatballs & Zoodles", calories: 370, cost: "$4.95", cookTime: "30 min", description: "Lean meatballs over zucchini noodles." },
  { name: "Egg White Frittata", calories: 260, cost: "$3.20", cookTime: "20 min", description: "Light, protein‑rich eggs with veggies." },
  { name: "Black Bean Tacos", calories: 340, cost: "$4.10", cookTime: "15 min", description: "Spiced beans in corn tortillas." },
  { name: "Grilled Chicken Salad", calories: 310, cost: "$5.00", cookTime: "20 min", description: "Mixed greens with lean chicken breast." },
  { name: "Roasted Veg & Quinoa Bowl", calories: 400, cost: "$5.50", cookTime: "30 min", description: "Seasonal veggies and quinoa." },
  { name: "Salmon Burgers & Spinach", calories: 450, cost: "$7.00", cookTime: "20 min", description: "Fish patty on a bed of fresh spinach." },
  { name: "Chicken & Veg Kebabs", calories: 380, cost: "$5.75", cookTime: "25 min", description: "Skewered lean chicken and peppers." },
  { name: "Turkey Chili", calories: 420, cost: "$4.80", cookTime: "45 min", description: "Spiced turkey in a tomato bean broth." },
  { name: "Shrimp Stir Fry & Rice", calories: 430, cost: "$6.20", cookTime: "20 min", description: "Seafood and veggies over brown rice." },
  { name: "Oatmeal with Nuts & Berries", calories: 290, cost: "$2.90", cookTime: "10 min", description: "Whole oats topped with fruit." },
  { name: "Grilled Shrimp Salad", calories: 360, cost: "$6.40", cookTime: "15 min", description: "Lean shrimp on mixed greens." },
  { name: "Stuffed Bell Peppers", calories: 410, cost: "$5.30", cookTime: "40 min", description: "Peppers filled with lean meat and rice." },
  { name: "Trout with Lemon & Herbs", calories: 440, cost: "$7.10", cookTime: "25 min", description: "Flavorful white fish with greens." },
  { name: "Turkey & Avocado Wrap", calories: 330, cost: "$4.60", cookTime: "10 min", description: "Lean turkey and avocado in a whole wheat wrap." },
  { name: "Veggie Omelet & Salsa", calories: 280, cost: "$3.50", cookTime: "10 min", description: "Eggs and veggies with fresh salsa." },
  { name: "Sweet Potato & Black Beans", calories: 380, cost: "$4.20", cookTime: "35 min", description: "Fiber‑rich sweet potato stuffed with beans." },
  { name: "Greek Chicken & Salad", calories: 400, cost: "$6.25", cookTime: "20 min", description: "Herb‑marinated chicken on Greek salad." },
  { name: "Quinoa & Berry Breakfast Bowl", calories: 300, cost: "$3.00", cookTime: "5 min", description: "High‑fiber quinoa with fresh fruit." }
];

const DashMealOfTheDay: React.FC = () => {
  const today = new Date().getDate();
  const meal = dashMeals[today % dashMeals.length];

  return (
    <section className="bg-white border-2 border-wellfit-green p-6 rounded-xl shadow-md">
      <h2 className="text-xl font-semibold text-wellfit-blue mb-2">DASH Meal of the Day</h2>
      <p className="text-gray-900 font-bold">{meal.name}</p>
      <p className="text-gray-700">{meal.description}</p>
      <ul className="text-sm text-gray-600 mt-2 space-y-1">
        <li><strong>Calories:</strong> {meal.calories}</li>
        <li><strong>Cost:</strong> {meal.cost}</li>
        <li><strong>Cook Time:</strong> {meal.cookTime}</li>
      </ul>
      <p className="mt-4 text-xs text-gray-500 italic">
        <strong>What is DASH?</strong> Dietary Approaches to Stop Hypertension – a balanced plan proven to lower blood pressure.
      </p>
    </section>
  );
};

export default DashMealOfTheDay;

