import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
// ✅ Use the src path from the script folder
import recipesWeek1 from '../src/data/recipesWeek1';
import recipesWeek2 from '../src/data/recipesWeek2';
import recipesWeek3 from '../src/data/recipesWeek3';
import recipesWeek4 from '../src/data/recipesWeek4';
import recipesBonus from '../src/data/recipesBonus';



type Recipe = {
  name: string;
  images?: string[];
  ingredients: string[];
  steps: string[];
  calories?: number;
  cost?: number;
  cook_time?: string;
  cook_temp?: string;
  tags?: string; // keeping as csv string to match your column
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

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY; // ✅ service key only

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const UPSERT = args.has('--upsert');

const BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const UPSERT_KEY = 'name'; // change if you prefer a different natural key

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function deterministicId(name: string): string {
  return `meal-${slugify(name)}`;
}

function transform(recipes: Recipe[]): Meal[] {
  const now = new Date().toISOString();
  return recipes.map((r) => ({
    id: deterministicId(r.name),
    name: r.name,
    image_url: r.images?.[0] || 'https://example.com/default-meal.jpg',
    ingredients: r.ingredients ?? [],
    steps: r.steps ?? [],
    calories: r.calories ?? 0,
    cost: r.cost ?? 0,
    cook_time: r.cook_time ?? '',
    cook_temp: r.cook_temp ?? '',
    tags: r.tags ?? '',
    created_at: now,
  }));
}

async function insertBatch(batch: Meal[], batchNum: number): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (UPSERT) {
        const { error } = await supabase
          .from('meals')
          .upsert(batch, { onConflict: UPSERT_KEY, ignoreDuplicates: false });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('meals').insert(batch);
        if (error) throw error;
      }
      console.log(`✅ Batch ${batchNum} (${batch.length} rows)`);
      return;
    } catch (err: any) {
      const msg = err?.message || String(err);
      const isLast = attempt === MAX_RETRIES;
      console.warn(
        `⚠️  Batch ${batchNum} attempt ${attempt}/${MAX_RETRIES} failed: ${msg}`
      );
      if (isLast) throw err;
      // Simple backoff
      const waitMs = 500 * attempt;
      await new Promise((res) => setTimeout(res, waitMs));
    }
  }
}

async function importMeals() {
  // ✅ Build once to avoid TS type fights
const allMeals: Meal[] = transform([
  ...recipesWeek1,
  ...recipesWeek2,
  ...recipesWeek3,
  ...recipesWeek4,
  ...recipesBonus,
] as any[]);

  // Optional: de-dup by name within the incoming set (prevents same-name rows in single run)
  const seen = new Set<string>();
  const uniqueMeals = allMeals.filter((m) => {
    if (seen.has(m.name)) return false;
    seen.add(m.name);
    return true;
  });

  console.log(`🌿 Prepared ${uniqueMeals.length} unique meals.`);
  if (DRY_RUN) {
    console.log('🔎 DRY RUN — showing first 3 rows:');
    console.dir(uniqueMeals.slice(0, 3), { depth: null });
    console.log('No rows were written (use --upsert or remove --dry-run to proceed).');
    return;
  }

  let total = 0;
  for (let i = 0; i < uniqueMeals.length; i += BATCH_SIZE) {
    const batch = uniqueMeals.slice(i, i + BATCH_SIZE);
    const batchNum = i / BATCH_SIZE + 1;
    await insertBatch(batch, batchNum);
    total += batch.length;
  }

  console.log(`🎉 Completed import of ${total} meals. Mode: ${UPSERT ? 'UPSERT' : 'INSERT'}`);
}

importMeals().catch((err) => {
  console.error('❌ Import failed:', err?.message || err);
  process.exit(1);
});
