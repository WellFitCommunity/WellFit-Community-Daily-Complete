"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const DashMealOfTheDay = ({ onSeeDetails }) => {
    const meal = {
        id: 1,
        name: 'Grilled Chicken Salad',
        description: 'A heart-healthy salad with lean protein and fresh greens.',
        calories: 390,
        imageUrl: 'https://images.unsplash.com/photo-1604908177079-3100d1d8045d?auto=format&fit=crop&w=800&q=80',
    };
    return (<div className="bg-white text-[#003865] rounded-xl shadow-md p-4 space-y-3">
      <h2 className="text-xl font-bold">DASH Meal of the Day</h2>
      <p className="text-sm text-[#003865]/80 italic">
        DASH = Dietary Approaches to Stop Hypertension
      </p>
      <img src={meal.imageUrl} alt={meal.name} className="rounded-md w-full max-h-52 object-cover"/>
      <h3 className="text-lg font-semibold">{meal.name}</h3>
      <p>{meal.description}</p>
      <p className="text-sm font-medium">~ {meal.calories} calories</p>
      <button className="mt-2 px-4 py-2 bg-[#8cc63f] text-white font-semibold rounded hover:bg-[#003865] transition" onClick={() => onSeeDetails(meal.id)}>
        See Full Recipe
      </button>
    </div>);
};
exports.default = DashMealOfTheDay;
