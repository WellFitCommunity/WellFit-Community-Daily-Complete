import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import week1 from '../data/recipesWeek1';
import week2 from '../data/recipesWeek2';
import week3 from '../data/recipesWeek3';
import week4 from '../data/recipesWeek4';
import bonus from '../data/recipesBonus';

dotenv.config();

// ✅ Validate environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

type Recipe = {
  name: string;
  images: string[];
  ingredients: string[];
  steps: string[];
  calories?: number;
  cost?: number;
  cook_time?: string;
  cook_temp?: string;
  tags?: string;
};

type Meal = {
  id: string;
  name: string;
  image_url: string;
  ingredients: string[];
  steps: string[];
  calories: number;
  cost: number;
  cook_time: string;
  cook_temp: string;
  tags: string;
  created_at: string;
};

// 🔧 Utility to generate unique, readable IDs
function generateId(name: string): string {
  const cleanName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  return `meal-${cleanName}-${Math.random().toString(36).substring(2, 6)}`;
}

// 🔄 Convert Recipe[] to Meal[]
function transform(recipes: Recipe[]): Meal[] {
  return recipes.map((r) => ({
    id: generateId(r.name),
    name: r.name,
    image_url: r.images[0] || 'https://example.com/default-meal.jpg',
    ingredients: r.ingredients,
    steps: r.steps,
    calories: r.calories ?? 0,
    cost: r.cost ?? 0,
    cook_time: r.cook_time ?? '',
    cook_temp: r.cook_temp ?? '',
    tags: r.tags ?? '',
    created_at: new Date().toISOString(),
  }));
}

// 🛠 Main import function
async function importMeals() {
  try {
    const allMeals: Meal[] = [
      ...transform(week1),
      ...transform(week2),
      ...transform(week3),
      ...transform(week4),
      ...transform(bonus),
    ];

    console.log(`🌿 Preparing to import ${allMeals.length} meals...`);

    const batchSize = 100;
    let totalInserted = 0;

    for (let i = 0; i < allMeals.length; i += batchSize) {
      const batch = allMeals.slice(i, i + batchSize);
      const { error } = await supabase.from('meals').insert(batch);

      if (error) {
        console.error(`❌ Batch ${i / batchSize + 1} failed:`, error.message);
        process.exit(1);
      }

      totalInserted += batch.length;
      console.log(`✅ Batch ${i / batchSize + 1} inserted (${totalInserted}/${allMeals.length})`);
    }

    console.log(`🎉 All ${totalInserted} meals imported successfully!`);
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Unexpected error:', err.message || err);
    process.exit(1);
  }
}

importMeals();
