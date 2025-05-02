// src/pages/MealDetailPage.tsx
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import meals, { Meal } from  '../components/DashMealOfTheDay'; // Import meals from the original file

// Mapping of recipe details by meal name
const recipeData: Record<string, { images: string[]; ingredients: string[]; steps: string[] }> = {
  "Grilled Salmon with Quinoa": {
    images: [
      "https://source.unsplash.com/featured/?grilled-salmon",
      "https://source.unsplash.com/featured/?quinoa"
    ],
    ingredients: [
      "1 (6 oz) salmon fillet",
      "½ cup quinoa, rinsed",
      "1 tbsp olive oil",
      "Salt & pepper",
      "Lemon wedges"
    ],
    steps: [
      "Preheat grill to medium-high.",
      "Season salmon with oil, salt, and pepper.",
      "Grill 4–5 min per side until opaque.",
      "Cook quinoa per package directions.",
      "Serve salmon atop quinoa with lemon."
    ]
  },
  "Turkey Lettuce Wraps": {
    images: [
      "https://source.unsplash.com/featured/?turkey-lettuce-wrap",
      "https://source.unsplash.com/featured/?lettuce-wrap"
    ],
    ingredients: [
      "8 large lettuce leaves",
      "1 lb ground turkey",
      "1/2 onion, minced",
      "1 bell pepper, diced",
      "2 tbsp low-sodium soy sauce",
      "1 tsp grated ginger"
    ],
    steps: [
      "Sauté onion, pepper, and ginger 3 min.",
      "Add turkey; cook until no pink remains.",
      "Stir in soy sauce for 1 min.",
      "Spoon into lettuce cups and serve."
    ]
  },
  "Veggie Stir Fry with Brown Rice": {
    images: [
      "https://source.unsplash.com/featured/?vegetable-stir-fry",
      "https://source.unsplash.com/featured/?brown-rice"
    ],
    ingredients: [
      "1 cup brown rice",
      "2 tbsp sesame oil",
      "1 cup broccoli florets",
      "1 carrot, sliced",
      "2 tbsp soy sauce"
    ],
    steps: [
      "Cook rice per package instructions.",
      "Heat oil, stir-fry veggies 4 min.",
      "Add soy sauce and rice; toss to combine.",
      "Serve hot."
    ]
  },
  "Baked Chicken & Sweet Potato": {
    images: [
      "https://source.unsplash.com/featured/?baked-chicken",
      "https://source.unsplash.com/featured/?sweet-potato"
    ],
    ingredients: [
      "2 chicken breasts",
      "1 sweet potato, cubed",
      "2 tbsp olive oil",
      "1 tsp paprika",
      "Salt & pepper"
    ],
    steps: [
      "Preheat oven to 400°F.",
      "Toss potatoes with oil, paprika, salt, pepper.",
      "Arrange potatoes and chicken on baking sheet.",
      "Bake 25–30 min until cooked through.",
      "Serve sprinkled with parsley."
    ]
  },
  "Spinach & Feta Omelet": {
    images: [
      "https://source.unsplash.com/featured/?spinach-omelet",
      "https://source.unsplash.com/featured/?feta-omelet"
    ],
    ingredients: [
      "3 egg whites + 1 egg",
      "1 cup spinach",
      "2 tbsp feta cheese",
      "1 tsp olive oil"
    ],
    steps: [
      "Whisk eggs; season lightly.",
      "Sauté spinach in oil until wilted.",
      "Pour eggs over spinach; cook 2–3 min.",
      "Sprinkle feta; fold omelet and serve."
    ]
  },
  "Chickpea & Avocado Salad": {
    images: [
      "https://source.unsplash.com/featured/?chickpea-salad",
      "https://source.unsplash.com/featured/?avocado-salad"
    ],
    ingredients: [
      "1 can chickpeas, drained",
      "1 ripe avocado, diced",
      "1/2 cucumber, chopped",
      "1/4 red onion, thinly sliced",
      "2 tbsp olive oil",
      "1 tbsp lemon juice",
      "Salt & pepper"
    ],
    steps: [
      "Combine chickpeas, avocado, cucumber, red onion.",
      "Whisk oil, lemon juice, salt, pepper.",
      "Pour dressing over salad; toss gently.",
      "Serve immediately."
    ]
  },
  "Baked Cod with Asparagus": {
    images: [
      "https://source.unsplash.com/featured/?baked-cod",
      "https://source.unsplash.com/featured/?asparagus"
    ],
    ingredients: [
      "2 cod fillets",
      "1 bunch asparagus, trimmed",
      "2 tbsp olive oil",
      "1 tsp garlic powder",
      "Salt & pepper"
    ],
    steps: [
      "Preheat oven to 375°F.",
      "Toss asparagus with oil, salt, pepper; spread on tray.",
      "Place cod atop asparagus; brush with oil and garlic powder.",
      "Bake 15–18 min.",
      "Serve warm."
    ]
  },
  "Tofu & Vegetable Curry": {
    images: [
      "https://source.unsplash.com/featured/?tofu-curry",
      "https://source.unsplash.com/featured/?vegetable-curry"
    ],
    ingredients: [
      "1 block firm tofu, cubed",
      "2 cups mixed veggies",
      "1 can light coconut milk",
      "2 tbsp curry paste",
      "1 tbsp vegetable oil"
    ],
    steps: [
      "Heat oil; sauté tofu until golden; set aside.",
      "Cook curry paste 1 min.",
      "Add veggies and coconut milk; simmer 5 min.",
      "Return tofu; cook 3 more min.",
      "Serve over brown rice."
    ]
  },
  "Lentil Soup with Whole-Grain Bread": {
    images: [
      "https://source.unsplash.com/featured/?lentil-soup",
      "https://source.unsplash.com/featured/?whole-grain-bread"
    ],
    ingredients: [
      "1 cup lentils",
      "4 cups low-sodium broth",
      "1 carrot, diced",
      "1 celery stalk, diced",
      "1 small onion, chopped",
      "1 tbsp olive oil",
      "Salt & pepper"
    ],
    steps: [
      "Sauté onion, carrot, celery 5 min.",
      "Add lentils and broth; boil then simmer 25 min.",
      "Season to taste.",
      "Serve with bread."
    ]
  },
  "Turkey Meatballs & Zoodles": {
    images: [
      "https://source.unsplash.com/featured/?turkey-meatballs",
      "https://source.unsplash.com/featured/?zoodles"
    ],
    ingredients: [
      "1 lb ground turkey",
      "1 egg, beaten",
      "¼ cup breadcrumbs",
      "2 cloves garlic, minced",
      "1 tsp oregano",
      "2 zucchinis",
      "1 tbsp oil",
      "Salt & pepper"
    ],
    steps: [
      "Preheat oven to 375°F.",
      "Mix ingredients; form 12 meatballs.",
      "Bake 18–20 min.",
      "Sauté zoodles 2–3 min.",
      "Serve meatballs atop zoodles."
    ]
  },
  "Egg White Frittata": {
    images: [
      "https://source.unsplash.com/featured/?egg-white-frittata",
      "https://source.unsplash.com/featured/?frittata"
    ],
    ingredients: [
      "6 egg whites",
      "½ cup spinach",
      "¼ cup tomatoes",
      "2 tbsp Parmesan",
      "1 tsp oil",
      "Salt & pepper"
    ],
    steps: [
      "Broil on high.",
      "Sauté spinach & tomatoes 2 min.",
      "Pour egg whites; cook 3-4 min.",
      "Broil 1-2 min.",
      "Slice and serve."
    ]
  },
  "Black Bean Tacos": {
    images: [
      "https://source.unsplash.com/featured/?black-bean-tacos",
      "https://source.unsplash.com/featured/?tacos"
    ],
    ingredients: [
      "8 corn tortillas",
      "1 can black beans",
      "1 tsp cumin",
      "½ tsp chili powder",
      "1 avocado",
      "½ cup lettuce",
      "Salsa"
    ],
    steps: [
      "Warm tortillas.",
      "Heat beans with spices 2 min.",
      "Fill with beans, lettuce, avocado, salsa.",
      "Serve immediately."
    ]
  },
  "Grilled Chicken Salad": {
    images: [
      "https://source.unsplash.com/featured/?grilled-chicken-salad",
      "https://source.unsplash.com/featured/?chicken-salad"
    ],
    ingredients: [
      "2 grilled chicken breasts",
      "4 cups greens",
      "½ cucumber",
      "½ cup tomatoes",
      "2 tbsp vinaigrette"
    ],
    steps: [
      "Arrange greens; top with chicken, cucumber, tomatoes.",
      "Drizzle vinaigrette; toss.",
      "Serve chilled."
    ]
  },
  "Roasted Veg & Quinoa Bowl": {
    images: [
      "https://source.unsplash.com/featured/?veggie-quinoa-bowl",
      "https://source.unsplash.com/featured/?roasted-vegetables"
    ],
    ingredients: [
      "1 cup quinoa",
      "1 cup broccoli",
      "1 bell pepper",
      "1 zucchini",
      "2 tbsp oil",
      "Salt & pepper"
    ],
    steps: [
      "Roast veggies 20-25 min at 425°F.",
      "Cook quinoa.",
      "Assemble and serve."
    ]
  },
  "Salmon Burgers & Spinach": {
    images: [
      "https://source.unsplash.com/featured/?salmon-burger",
      "https://source.unsplash.com/featured/?spinach"
    ],
    ingredients: [
      "1 lb salmon",
      "1 egg",
      "¼ cup breadcrumbs",
      "1 tsp mustard",
      "2 cups spinach",
      "1 tbsp oil"
    ],
    steps: [
      "Mix ingredients; form patties.",
      "Cook 4-5 min per side.",
      "Sauté spinach.",
      "Serve."
    ]
  },
  "Chicken & Veg Kebabs": {
    images: [
      "https://source.unsplash.com/featured/?chicken-kebab",
      "https://source.unsplash.com/featured/?vegetable-kebab"
    ],
    ingredients: [
      "2 chicken breasts",
      "1 bell pepper",
      "1 zucchini",
      "2 tbsp oil",
      "1 tsp oregano",
      "Salt & pepper"
    ],
    steps: [
      "Skewer chicken & veggies.",
      "Brush with oil & seasonings.",
      "Grill 10-12 min."
    ]
  },
  "Turkey Chili": {
    images: [
      "https://source.unsplash.com/featured/?turkey-chili",
      "https://source.unsplash.com/featured/?chili"
    ],
    ingredients: [
      "1 lb turkey",
      "1 can beans",
      "1 can tomatoes",
      "1 onion",
      "2 tbsp chili powder",
      "2 cups broth"
    ],
    steps: [
      "Sauté onion.",
      "Add turkey; brown.",
      "Add rest; simmer 20 min."
    ]
  },
  "Shrimp Stir Fry & Rice": {
    images: [
      "https://source.unsplash.com/featured/?shrimp-stir-fry",
      "https://source.unsplash.com/featured/?rice"
    ],
    ingredients: [
      "1 lb shrimp",
      "2 cups veggies",
      "2 tbsp soy sauce",
      "1 tbsp oil",
      "1 cup rice"
    ],
    steps: [
      "Cook shrimp; set aside.",
      "Stir-fry veggies.",
      "Combine and serve."
    ]
  },
  "Oatmeal with Nuts & Berries": {
    images: [
      "https://source.unsplash.com/featured/?oatmeal",
      "https://source.unsplash.com/featured/?berries"
    ],
    ingredients: [
      "½ cup oats",
      "1 cup milk",
      "¼ cup berries",
      "2 tbsp nuts",
      "1 tsp honey"
    ],
    steps: [
      "Cook oats.",
      "Top and serve."
    ]
  },
  "Grilled Shrimp Salad": {
    images: [
      "https://source.unsplash.com/featured/?grilled-shrimp-salad",
      "https://source.unsplash.com/featured/?shrimp-salad"
    ],
    ingredients: [
      "½ lb shrimp",
      "4 cups greens",
      "1 avocado",
      "½ cup tomatoes",
      "2 tbsp oil",
      "1 tbsp lemon",
      "Salt & pepper"
    ],
    steps: [
      "Season & cook shrimp.",
      "Assemble salad.",
      "Dress and serve."
    ]
  },
  "Stuffed Bell Peppers": {
    images: [
      "https://source.unsplash.com/featured/?stuffed-bell-peppers",
      "https://source.unsplash.com/featured/?bell-peppers"
    ],
    ingredients: [
      "4 peppers",
      "1 cup rice",
      "1 lb turkey",
      "1 can tomatoes",
      "1 tsp seasoning",
      "Salt & pepper"
    ],
    steps: [
      "Brown turkey & mix with rice/tomatoes.",
      "Stuff peppers; bake 30 min covered, 5 uncovered."
    ]
  },
  "Trout with Lemon & Herbs": {
    images: [
      "https://source.unsplash.com/featured/?trout-fish",
      "https://source.unsplash.com/featured/?lemon-herbs"
    ],
    ingredients: [
      "2 trout fillets",
      "2 tbsp oil",
      "1 lemon",
      "1 tbsp parsley",
      "Salt & pepper"
    ],
    steps: [
      "Season trout & top with lemon/parsley.",
      "Bake 12–15 min at 400°F."
    ]
  },
  "Turkey & Avocado Wrap": {
    images: [
      "https://source.unsplash.com/featured/?turkey-avocado-wrap",
      "https://source.unsplash.com/featured/?avocado-wrap"
    ],
    ingredients: [
      "2 tortillas",
      "6 oz turkey",
      "1 avocado",
      "1 cup greens",
      "1 tbsp spread"
    ],
    steps: [
      "Layer ingredients in tortilla.",
      "Roll & slice."
    ]
  },
  "Veggie Omelet & Salsa": {
    images: [
      "https://source.unsplash.com/featured/?veggie-omelet",
      "https://source.unsplash.com/featured/?salsa"
    ],
    ingredients: [
      "3 eggs",
      "½ cup veggies",
      "1 tbsp oil",
      "2 tbsp salsa",
      "Salt & pepper"
    ],
    steps: [
      "Sauté veggies.",
      "Add eggs; cook & fold.",
      "Top with salsa."
    ]
  }
};

type Recipe = typeof recipeData[keyof typeof recipeData];

const MealDetailPage: React.FC = () => {
  // Determine today's meal based on date
  const todayIndex = new Date().getDate() % meals.length;
  const meal: Meal = meals[todayIndex];
  const recipe: Recipe | undefined = recipeData[meal.name];

  useEffect(() => {
    if (recipe) console.log('Rendering images for', meal.name, recipe.images);
  }, [meal.name, recipe]);

  if (!recipe) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-600">Recipe details not found for this meal.</p>
        <Link to="/dashboard" className="underline text-wellfit-blue">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <Link to="/dashboard" className="text-sm underline text-wellfit-blue mb-4 inline-block">
        ← Back to Dashboard
      </Link>

      <h1 className="text-3xl font-bold text-wellfit-blue mb-2">{meal.name}</h1>
      {meal.description && (
        <p className="text-gray-700 mb-4">{meal.description}</p>
      )}

      {/* Images Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {recipe.images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`${meal.name} image ${i + 1}`}
            className="w-full h-auto rounded-lg shadow-md"
          />
        ))}
      </div>

      {/* Meal stats */}
      <ul className="bg-white border rounded-lg p-4 text-gray-800 mb-6 space-y-1">
        <li><strong>Calories:</strong> {meal.calories}</li>
        <li><strong>Cost:</strong> ${meal.cost.toFixed(2)}</li>
        <li><strong>Cook Time:</strong> {meal.cookTime}</li>
      </ul>

      {/* Ingredients */}
      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Ingredients</h2>
        <ul className="list-disc list-inside space-y-1">
          {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
        </ul>
      </section>

      {/* Instructions */}
      <section className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Instructions</h2>
        <ol className="list-decimal list-inside space-y-1">
          {recipe.steps.map((step, i) => <li key={i}>{step}</li>)}
        </ol>
      </section>
    </div>
  );
};

export default MealDetailPage;
