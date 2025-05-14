"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/scripts/importMeals.ts
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const recipesWeek1_1 = __importDefault(require("../data/recipesWeek1"));
const recipesWeek2_1 = __importDefault(require("../data/recipesWeek2"));
const recipesWeek3_1 = __importDefault(require("../data/recipesWeek3"));
const recipesWeek4_1 = __importDefault(require("../data/recipesWeek4"));
const recipesBonus_1 = __importDefault(require("../data/recipesBonus"));
async function importMeals() {
    const rawRecipes = [...recipesWeek1_1.default, ...recipesWeek2_1.default, ...recipesWeek3_1.default, ...recipesWeek4_1.default, ...recipesBonus_1.default];
    const allMeals = rawRecipes.map((recipe, index) => ({
        id: `meal-${index + 1}`,
        name: recipe.name,
        description: 'A healthy and delicious recipe.',
        calories: 350,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        image_url: recipe.images?.[0] || '',
    }));
    const { data = [], error } = await supabase.from('meals').insert(allMeals);
    if (error) {
        console.error('❌ Error importing meals:', error.message);
        process.exit(1);
    }
    const inserted = Array.isArray(data) ? data.length : 0;
    console.log(`✅ Import successful! Inserted ${inserted} meals.`);
    process.exit(0);
}
importMeals();
