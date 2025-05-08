// src/data/recipesBonus.ts
import { Recipe } from './types';

const recipesBonus: Recipe[] = [
  {
    name: "Chickpea and Avocado Salad Wrap",
    images: [
      "https://images.unsplash.com/photo-1568605114967-8130f3a36994"
    ],
    ingredients: [
      "1/2 cup canned chickpeas, mashed",
      "1/2 avocado",
      "1 tablespoon lemon juice",
      "1 tablespoon chopped red onion",
      "Salt and pepper to taste",
      "1 whole wheat tortilla"
    ],
    steps: [
      "Mash chickpeas and avocado in a bowl.",
      "Mix in lemon juice, red onion, salt, and pepper.",
      "Spread onto tortilla, roll tightly, and slice in half.",
      "Serve fresh or chilled."
    ]
  },
  {
    name: "Eggplant and Tomato Stew",
    images: [
      "https://images.unsplash.com/photo-1627308595229-7830a5c91f9f"
    ],
    ingredients: [
      "1 cup eggplant, cubed",
      "1/2 cup diced tomato",
      "1/4 onion, diced",
      "1 tablespoon olive oil",
      "1/2 teaspoon cumin",
      "Salt and pepper to taste"
    ],
    steps: [
      "Heat olive oil in a saucepan and sauté onion and eggplant for 5–6 minutes.",
      "Add tomato, cumin, salt, and pepper. Cover and simmer 15–20 minutes.",
      "Stir occasionally until eggplant is tender.",
      "Serve with brown rice or lentils."
    ]
  },
  {
    name: "Fruit and Nut Breakfast Bowl",
    images: [
      "https://images.unsplash.com/photo-1615484477273-8509a8e29a85"
    ],
    ingredients: [
      "1/2 cup plain Greek yogurt",
      "1/4 banana, sliced",
      "1 tablespoon almonds, chopped",
      "1 tablespoon raisins",
      "1 teaspoon chia seeds",
      "1 drizzle of honey (optional)"
    ],
    steps: [
      "In a bowl, layer Greek yogurt, banana slices, and chopped almonds.",
      "Sprinkle raisins and chia seeds on top.",
      "Drizzle with honey if desired.",
      "Serve chilled or immediately."
    ]
  }
];

export default recipesBonus;
